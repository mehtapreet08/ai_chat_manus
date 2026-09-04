from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
import datetime
from google import genai
from google.genai import types
from dotenv import load_dotenv
import traceback
from rate_manager import GeminiRateManager

# Load environment variables
load_dotenv()

app = Flask(__name__)

# --- Configuration ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment variables.")

# Initialize Gemini Client
try:
    if GEMINI_API_KEY:
        client = genai.Client(api_key=GEMINI_API_KEY)
    else:
        client = None
        print("WARNING: Client not initialized (Missing API Key)")
except Exception as e:
    client = None
    print(f"Error initializing client: {e}")

DATA_DIR = os.path.join(os.getcwd(), 'brainstorm_studio', 'data', 'brainstorm_sessions')
os.makedirs(DATA_DIR, exist_ok=True)

# --- Agent Personas ---

PROMPTS = {
    "Analyst": """
        ROLE: Neutral Analyst & Fact-Checker.
        TONE: Strictly neutral, objective, data-driven, concise.
        TASKS:
        1. You are the FIRST to respond.
        2. Use the "search" tool to verify facts about the user's idea if necessary.
        3. Provide a factual summary of opportunities, market data, or technical realities.
        4. If search is unavailable, rely on internal knowledge but state it clearly.
        5. DO NOT offer opinions or excitement. Just facts.
    """,
    "Visionary": """
        ROLE: Visionary & 10x Thinker.
        TONE: High-energy, bold, ambitious, enthusiastic (🚀).
        TASKS:
        1. You receive the User's idea + Analyst's factual context.
        2. IGNORE constraints for now. Focus on the "What if?".
        3. Propose 10x expansions, massive scale, and future potential.
        4. Be supportive and inspire the user.
    """,
    "Realist": """
        ROLE: Skeptical Realist & Risk Manager.
        TONE: Calm, cautious, grounded, critical (⚠️).
        TASKS:
        1. You receive the User's idea + Analyst's factual context.
        2. Focus on FEASIBILITY: cost, time, legal hurdles, technical debt, competition.
        3. Point out why the Visionary's ideas might fail.
        4. Protect the user from bad investments.
    """,
    "Analyst_Synthesis": """
        ROLE: Synthesis & Mediator.
        TONE: Balanced, professional, constructive (📊).
        TASKS:
        1. Read the User's idea, Visionary's input, and Realist's input.
        2. Synthesize a recommendation that balances ambition with feasibility.
        3. Correct any factual exaggerations from either side.
        4. Propose concrete next steps.
    """
}

# --- Helper Functions ---

def get_gemini_response(prompt, context_messages, task_type="categorization", tools=None):
    """
    Generic function to get response from Gemini with Rate Limit Management and Fallback.
    context_messages: List of strings or message objects to include in context.
    task_type: "categorization" (high throughput) or "ai insights" (high quality, low rate)
    """
    if not client:
        return "[MOCK RESPONSE] Gemini API Key missing. This is a placeholder response from the agent."

    # Convert context messages to API format once
    history = []
    for msg in context_messages:
        role = "user" if msg['role'] == "user" else "model"
        history.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=f"[{msg['role']}]: {msg['content']}")]
        ))

    # Get candidate models
    models = GeminiRateManager.get_models_for_task(task_type)
    if not models:
        # Fallback if task type invalid
        models = ["gemini-2.5-flash", "gemini-2.0-flash"]

    last_error = None

    for model_name in models:
        # Check local rate tracking (soft check)
        if not GeminiRateManager.check_availability(model_name, GEMINI_API_KEY):
            print(f"Skipping {model_name} due to local rate limit check.")
            continue

        print(f"Attempting to use model: {model_name}...")

        try:
            generate_content_config = types.GenerateContentConfig(
                temperature=0.7,
                top_p=0.95,
                top_k=40,
                max_output_tokens=2048,
                system_instruction=prompt,
                tools=tools
            )

            response = client.models.generate_content(
                model=model_name,
                contents=history,
                config=generate_content_config
            )

            # Success! Register usage
            # We estimate tokens roughly (1 word ~= 1.3 tokens) or just count request
            GeminiRateManager.register_usage(GEMINI_API_KEY, tokens_used=100)
            return response.text

        except Exception as e:
            error_str = str(e)
            print(f"Error calling Gemini model {model_name}: {error_str}")
            # If 429 or ResourceExhausted, we definitely want to continue
            # If 404 (Model not found), continue
            # We'll just continue for all errors in the loop to be robust
            last_error = e
            continue

    # If we get here, all models failed
    print("All models failed.")
    if last_error:
        traceback.print_exc()
        return f"Error: All AI models unavailable. Last error: {str(last_error)}"
    return "Error: No suitable AI models found available."

def save_session_to_disk(session_id, messages):
    filename = f"{session_id}.json"
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump({"id": session_id, "messages": messages, "timestamp": str(datetime.datetime.now())}, f, indent=2)
    return filepath

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message')
    history = data.get('history', []) # Full history for Analyst

    session_id = data.get('sessionId')
    if not session_id:
        session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    # 1. Analyst Phase (Research)
    # Analyst gets full history
    analyst_context = history + [{"role": "user", "content": user_message}]

    # Enable Google Search tool for Analyst
    google_search_tool = [types.Tool(google_search=types.GoogleSearch())]

    # Use "categorization" task type for robustness as requested, or "ai insights" if we want to risk it.
    # Given the requirement "so that our codes don't crash", we use the high-throughput pool.
    analyst_response_text = get_gemini_response(
        PROMPTS["Analyst"],
        analyst_context,
        task_type="categorization",
        tools=google_search_tool
    )

    analyst_msg = {"role": "Analyst", "content": analyst_response_text}

    # 2. Visionary & Realist Phase (Parallel)
    # They get limited context: last 10 messages + Analyst brief
    short_history = history[-10:] if len(history) > 10 else history
    # We explicitly add the analyst's findings to their context
    agent_context = short_history + [
        {"role": "user", "content": user_message},
        {"role": "Analyst", "content": analyst_response_text}
    ]

    visionary_response_text = get_gemini_response(PROMPTS["Visionary"], agent_context, task_type="categorization")
    realist_response_text = get_gemini_response(PROMPTS["Realist"], agent_context, task_type="categorization")

    visionary_msg = {"role": "Visionary", "content": visionary_response_text}
    realist_msg = {"role": "Realist", "content": realist_response_text}

    # 3. Analyst Synthesis Phase
    # Analyst sees everything including the new responses
    synthesis_context = analyst_context + [analyst_msg, visionary_msg, realist_msg]
    synthesis_response_text = get_gemini_response(PROMPTS["Analyst_Synthesis"], synthesis_context, task_type="categorization")

    synthesis_msg = {"role": "Analyst", "content": synthesis_response_text} # Appended as a second Analyst message or just "Synthesis"

    # Construct response payload
    new_messages = [
        {"role": "user", "content": user_message},
        analyst_msg,
        visionary_msg,
        realist_msg,
        synthesis_msg
    ]

    # Save session
    full_updated_history = history + new_messages
    save_session_to_disk(session_id, full_updated_history)

    return jsonify({
        "sessionId": session_id,
        "newMessages": [analyst_msg, visionary_msg, realist_msg, synthesis_msg]
    })

@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json')]
    sessions = []
    for f in files:
        try:
            with open(os.path.join(DATA_DIR, f), 'r') as file:
                data = json.load(file)
                sessions.append({
                    "id": data.get("id", f.replace(".json", "")),
                    "timestamp": data.get("timestamp", ""),
                    "preview": data["messages"][0]["content"] if data.get("messages") else "Empty"
                })
        except:
            pass
    return jsonify(sessions)

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    filepath = os.path.join(DATA_DIR, f"{session_id}.json")
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return jsonify(json.load(f))
    return jsonify({"error": "Session not found"}), 404

@app.route('/api/import', methods=['POST'])
def import_session():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if file:
        try:
            content = json.load(file)
            session_id = content.get("id", datetime.datetime.now().strftime("%Y%m%d_%H%M%S"))
            # Validate format roughly
            if "messages" not in content:
                 return jsonify({"error": "Invalid format"}), 400

            save_session_to_disk(session_id, content["messages"])
            return jsonify({"success": True, "sessionId": session_id})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Brainstorm Studio...")
    print(f"Saving sessions to: {DATA_DIR}")
    app.run(host='0.0.0.0', port=5000, debug=True)
