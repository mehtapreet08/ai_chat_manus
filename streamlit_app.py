from __future__ import annotations

import os
import re
import threading
from pathlib import Path
from typing import Dict

import streamlit as st

try:
    from google import genai
    from google.genai import types
except ImportError:  # Optional until a hosted app installs requirements.
    genai = None
    types = None


APP_ROOT = Path(__file__).parent
PROMPT_FILE = APP_ROOT / "attached_assets" / "Pasted--Updated-Prompts-More-Natural-DM-Style-Less-Drama-Whisperer-3-0-Casual-Subtext-Reader-You-1763396803302_1763396803303.txt"
PROMPT_LOCK = threading.Lock()

MODE_SECTIONS = {
    "Whisperer": "🌫 Whisperer 3.0",
    "Chaos Mode": "🌀 Chaos Mode 3.0",
    "Velvet Shadows": "🖤 Velvet Shadows 3.0",
    "Unspoken Longing": "🌙 Unspoken Longing 3.0",
    "Wink & Whisper": "😉 Wink & Whisper 3.0",
    "Comedy Trickster": "🤡 Comedy Trickster 3.0",
    "Neutral": "📌 Neutral 3.0",
}


def load_prompts() -> Dict[str, str]:
    """Read the supplied prompt asset without rewriting or normalizing its wording."""
    raw = PROMPT_FILE.read_text(encoding="utf-8") if PROMPT_FILE.exists() else ""
    prompts: Dict[str, str] = {}
    for label, heading in MODE_SECTIONS.items():
        start = raw.find(heading)
        if start < 0:
            prompts[label] = raw
            continue
        following = [raw.find(next_heading, start + len(heading)) for next_heading in MODE_SECTIONS.values()]
        ends = [position for position in following if position >= 0]
        prompts[label] = raw[start : min(ends) if ends else len(raw)].strip()
    return prompts


PROMPTS = load_prompts()


@st.cache_resource(show_spinner=False)
def get_client():
    key = os.getenv("GEMINI_API_KEY") or st.secrets.get("GEMINI_API_KEY", None)
    if not key or genai is None:
        return None
    return genai.Client(api_key=key)


def fallback_reply(text: str, mode: str) -> str:
    if mode == "Neutral":
        return f"Samajh aa raha hai yaar — tum keh rahe ho: {text}"
    if mode == "Comedy Trickster":
        return f"Arre wah, is message ne toh dimaag ko unnecessary overtime de diya: {text} 😄"
    if mode == "Chaos Mode":
        return f"Bhai isme kuch toh gadbad hai… ya phir dabba kisi aur ke ghar pahunch gaya: {text}"
    if mode == "Wink & Whisper":
        return f"Hmm, seedha message hai… par thoda sa attention bhi maang raha hai, hai na? {text}"
    if mode == "Unspoken Longing":
        return f"Lagta hai words simple hain, par peeche thoda sa miss-you type feeling hai: {text}"
    if mode == "Velvet Shadows":
        return f"Theek hai… par iske peeche kuch unsaid sa lag raha hai, idk yaar: {text}"
    return f"Matlab words se zyada feeling important hai — shayad tum kuch indirectly keh rahe ho: {text}"


def generate_reply(text: str, mode: str, history: list[dict[str, str]]) -> str:
    client = get_client()
    if client is None:
        return fallback_reply(text, mode)

    context = "\n".join(f"{item['role']}: {item['content']}" for item in history[-8:])
    prompt = PROMPTS.get(mode, PROMPTS.get("Whisperer", ""))
    system = f"""You are the AI Chat Middleman. Follow this prompt exactly:\n\n{prompt}\n\nConversation context:\n{context}\n\nReturn only the transformed reply. Keep it short and natural."""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=text,
            config=types.GenerateContentConfig(system_instruction=system, temperature=0.85, max_output_tokens=500),
        )
        return (response.text or fallback_reply(text, mode)).strip()
    except Exception as exc:
        # Keep the UI usable when a hosted key/model is unavailable.
        return f"AI abhi thoda busy hai. Local reading: {fallback_reply(text, mode)}"


def init_state() -> None:
    defaults = {"messages": [], "mode": "Whisperer", "name": "", "summary": ""}
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def render_message(item: dict[str, str]) -> None:
    role = item["role"]
    with st.chat_message("user" if role == "You" else "assistant"):
        if role != "You":
            st.caption(f"AI Middleman · {item.get('mode', st.session_state.mode)}")
        st.markdown(item["content"])


def main() -> None:
    st.set_page_config(page_title="AI Chat Middleman", page_icon="✨", layout="centered", initial_sidebar_state="collapsed")
    init_state()
    st.markdown("""
    <style>
      :root { --teal: #188d7e; }
      .stApp { background: radial-gradient(circle at 10% 0%, #e5f6f1 0, transparent 34%), #f4f8f7; }
      [data-testid="stHeader"] { background: transparent; }
      .hero { padding: 1.1rem 1.25rem; border: 1px solid #dceae6; border-radius: 18px; background: rgba(255,255,255,.8); margin-bottom: 1rem; }
      .hero h1 { font-size: 1.55rem; margin: 0; color: #16353c; letter-spacing: -.04em; }
      .hero p { color: #6a8382; margin: .25rem 0 0; font-size: .85rem; }
      .stButton button { border-radius: 11px; }
      [data-testid="stChatMessage"] { border-radius: 16px; }
      [data-testid="stSidebar"] { background: #ffffff; }
      @media (max-width: 600px) { .hero h1 { font-size: 1.25rem; } .block-container { padding: 1rem .75rem 5rem; } }
    </style>
    """, unsafe_allow_html=True)

    with st.sidebar:
        st.markdown("## Chat settings")
        st.session_state.mode = st.selectbox("AI persona", list(MODE_SECTIONS), index=list(MODE_SECTIONS).index(st.session_state.mode))
        st.session_state.name = st.text_input("Your name", value=st.session_state.name, placeholder="Optional")
        st.caption("Prompts are loaded from the supplied prompt assets and are not rewritten.")
        if st.button("New chat", use_container_width=True):
            st.session_state.messages = []
            st.session_state.summary = ""
            st.rerun()

    st.markdown(f"<div class='hero'><h1>✨ AI Chat Middleman</h1><p>Connected · {st.session_state.name or 'chatting privately'} · {st.session_state.mode}</p></div>", unsafe_allow_html=True)
    if not st.session_state.messages:
        st.info("Type a message below. Try changing the persona from the sidebar.")
    for item in st.session_state.messages:
        render_message(item)

    prompt = st.chat_input("Type your message…")
    if prompt and prompt.strip():
        text = prompt.strip()
        if text == "/mode":
            st.sidebar.selectbox("AI persona", list(MODE_SECTIONS), key="mode_command_select")
            st.info("Choose a persona from the sidebar.")
            st.stop()
        user_item = {"role": "You", "content": text}
        st.session_state.messages.append(user_item)
        with st.chat_message("user"):
            st.markdown(text)
        with st.chat_message("assistant"):
            st.caption(f"AI Middleman · {st.session_state.mode}")
            with st.spinner("Decoding the subtext…"):
                reply = generate_reply(text, st.session_state.mode, st.session_state.messages)
            st.markdown(reply)
        st.session_state.messages.append({"role": "AI", "content": reply, "mode": st.session_state.mode})
        st.rerun()


if __name__ == "__main__":
    main()
