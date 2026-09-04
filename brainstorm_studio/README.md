# Multi-Agent Brainstorm Studio

A standalone, local-first multi-agent brainstorming environment powered by Google Gemini.

## Features
- **3 AI Personas**: Visionary (Optimist), Realist (Skeptic), Analyst (Fact-checker).
- **Multi-Turn Reasoning**: Agents interact with each other to refine ideas.
- **Web Search**: The Analyst uses Google Search grounding to provide factual context.
- **Local Storage**: All sessions are saved locally as JSON files.
- **Import/Export**: Easily backup or restore brainstorming sessions.

## Setup Instructions

### 1. Prerequisites
- Python 3.8 or higher
- A Google Gemini API Key (with search capabilities enabled)

### 2. Install Dependencies
Navigate to the `brainstorm_studio` directory and install the required packages:

```bash
cd brainstorm_studio
pip install flask google-genai python-dotenv
```

### 3. Environment Setup
Create a `.env` file in the `brainstorm_studio` directory (if not already present in the parent) and add your API key:

```ini
GEMINI_API_KEY=your_actual_api_key_here
```

*(Note: The app will also look for the key in the system environment variables)*

### 4. Run the App
Start the application server:

```bash
python app.py
```

You should see output indicating the server is running (usually at `http://127.0.0.1:5000`).

### 5. Deployment (Optional)
- **Mobile/Local Network**: run with `python app.py --host=0.0.0.0` to access it from other devices on your WiFi (e.g., `http://YOUR_PC_IP:5000`).
- **PWA**: The current web interface is responsive. To make it a true PWA, add a `manifest.json` and service worker in `static/`.

## Usage
1. Open your browser to `http://127.0.0.1:5000`.
2. Type an idea in the input box (e.g., "A subscription service for coffee delivery via drones").
3. Watch as:
   - **Analyst** researches the market.
   - **Visionary** expands on the potential.
   - **Realist** critiques the feasibility.
   - **Analyst** synthesizes a final recommendation.
