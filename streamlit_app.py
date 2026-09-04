from __future__ import annotations

import os
import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

import streamlit as st

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

APP_ROOT = Path(__file__).parent
PROMPT_FILE = APP_ROOT / "attached_assets" / "Pasted--Updated-Prompts-More-Natural-DM-Style-Less-Drama-Whisperer-3-0-Casual-Subtext-Reader-You-1763396803302_1763396803303.txt"
DB_PATH = Path(os.getenv("CHAT_DB_PATH", str(APP_ROOT / ".streamlit" / "chat.sqlite3")))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DB_LOCK = threading.RLock()

MODE_SECTIONS = {
    "Whisperer": "🌫 Whisperer 3.0",
    "Chaos Mode": "🌀 Chaos Mode 3.0",
    "Velvet Shadows": "🖤 Velvet Shadows 3.0",
    "Unspoken Longing": "🌙 Unspoken Longing 3.0",
    "Wink & Whisper": "😉 Wink & Whisper 3.0",
    "Comedy Trickster": "🤡 Comedy Trickster 3.0",
    "Neutral": "📌 Neutral 3.0",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=10000")
    return connection


def init_db() -> None:
    with DB_LOCK, db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS waiting (
            user_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            joined_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rooms (
            room_id TEXT PRIMARY KEY,
            passcode TEXT UNIQUE,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS members (
            room_id TEXT NOT NULL,
            user_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL DEFAULT 18,
            gender TEXT NOT NULL DEFAULT 'other',
            FOREIGN KEY(room_id) REFERENCES rooms(room_id)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            original TEXT NOT NULL,
            transformed TEXT NOT NULL,
            mode TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS messages_room_idx ON messages(room_id, id);
        """)
        # Migrate rooms created by the earlier automatic-matching version.
        room_columns = {row["name"] for row in connection.execute("PRAGMA table_info(rooms)")}
        member_columns = {row["name"] for row in connection.execute("PRAGMA table_info(members)")}
        if "passcode" not in room_columns:
            connection.execute("ALTER TABLE rooms ADD COLUMN passcode TEXT")
        if "age" not in member_columns:
            connection.execute("ALTER TABLE members ADD COLUMN age INTEGER NOT NULL DEFAULT 18")
        if "gender" not in member_columns:
            connection.execute("ALTER TABLE members ADD COLUMN gender TEXT NOT NULL DEFAULT 'other'")
        connection.commit()


def current_room(user_id: str) -> str | None:
    with DB_LOCK, db() as connection:
        row = connection.execute("SELECT room_id FROM members WHERE user_id = ?", (user_id,)).fetchone()
        return row["room_id"] if row else None


def create_lobby(user_id: str, name: str, age: int, gender: str) -> tuple[str, str]:
    """Create a private room and return its shareable six-character passcode."""
    clean_name = name.strip() or "Anonymous"
    with DB_LOCK, db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        room_id = uuid.uuid4().hex
        passcode = secrets.token_urlsafe(5).replace("-", "").replace("_", "")[:6].upper()
        while connection.execute("SELECT 1 FROM rooms WHERE passcode = ?", (passcode,)).fetchone():
            passcode = secrets.token_urlsafe(5).replace("-", "").replace("_", "")[:6].upper()
        connection.execute("INSERT INTO rooms(room_id, passcode, created_at) VALUES (?, ?, ?)", (room_id, passcode, utc_now()))
        connection.execute("INSERT INTO members(room_id, user_id, name, age, gender) VALUES (?, ?, ?, ?, ?)", (room_id, user_id, clean_name, age, gender))
        connection.commit()
        return room_id, passcode


def join_lobby(user_id: str, passcode: str, name: str, age: int, gender: str) -> tuple[str | None, str | None]:
    """Join a room by passcode atomically, rejecting invalid or full rooms."""
    clean_code = passcode.strip().upper()
    clean_name = name.strip() or "Anonymous"
    with DB_LOCK, db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        room = connection.execute("SELECT room_id FROM rooms WHERE passcode = ?", (clean_code,)).fetchone()
        if not room:
            connection.rollback()
            return None, "Passcode not found. Ask the host to share the current code."
        count = connection.execute("SELECT COUNT(*) AS count FROM members WHERE room_id = ?", (room["room_id"],)).fetchone()["count"]
        existing = connection.execute("SELECT room_id FROM members WHERE user_id = ?", (user_id,)).fetchone()
        if existing and existing["room_id"] == room["room_id"]:
            connection.commit()
            return room["room_id"], None
        if count >= 2:
            connection.rollback()
            return None, "This lobby already has two people. Create a new lobby instead."
        connection.execute("INSERT INTO members(room_id, user_id, name, age, gender) VALUES (?, ?, ?, ?, ?)", (room["room_id"], user_id, clean_name, age, gender))
        connection.commit()
        return room["room_id"], None


def leave_room(user_id: str) -> None:
    with DB_LOCK, db() as connection:
        connection.execute("DELETE FROM waiting WHERE user_id = ?", (user_id,))
        connection.execute("DELETE FROM members WHERE user_id = ?", (user_id,))
        connection.commit()


def get_partner(room_id: str, user_id: str) -> str:
    with DB_LOCK, db() as connection:
        row = connection.execute("SELECT name FROM members WHERE room_id = ? AND user_id != ? LIMIT 1", (room_id, user_id)).fetchone()
        return row["name"] if row else "your partner"


def room_passcode(room_id: str) -> str:
    with DB_LOCK, db() as connection:
        row = connection.execute("SELECT passcode FROM rooms WHERE room_id = ?", (room_id,)).fetchone()
        return row["passcode"] if row and row["passcode"] else ""


def room_member_count(room_id: str) -> int:
    with DB_LOCK, db() as connection:
        return int(connection.execute("SELECT COUNT(*) AS count FROM members WHERE room_id = ?", (room_id,)).fetchone()["count"])


def load_messages(room_id: str, viewer_id: str) -> list[dict[str, str]]:
    with DB_LOCK, db() as connection:
        rows = connection.execute("SELECT * FROM messages WHERE room_id = ? ORDER BY id", (room_id,)).fetchall()
    return [{"role": "You" if row["sender_id"] == viewer_id else row["sender_name"], "content": row["original"] if row["sender_id"] == viewer_id else row["transformed"], "mode": row["mode"], "created_at": row["created_at"]} for row in rows]


def save_message(room_id: str, sender_id: str, sender_name: str, original: str, transformed: str, mode: str) -> None:
    with DB_LOCK, db() as connection:
        connection.execute("INSERT INTO messages(room_id, sender_id, sender_name, original, transformed, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (room_id, sender_id, sender_name, original, transformed, mode, utc_now()))
        connection.commit()


def load_prompts() -> Dict[str, str]:
    raw = PROMPT_FILE.read_text(encoding="utf-8") if PROMPT_FILE.exists() else ""
    prompts: Dict[str, str] = {}
    headings = list(MODE_SECTIONS.values())
    for label, heading in MODE_SECTIONS.items():
        start = raw.find(heading)
        if start < 0:
            prompts[label] = raw
            continue
        positions = [raw.find(next_heading, start + len(heading)) for next_heading in headings]
        ends = [position for position in positions if position >= 0]
        prompts[label] = raw[start : min(ends) if ends else len(raw)].strip()
    return prompts


PROMPTS = load_prompts()


@st.cache_resource(show_spinner=False)
def get_client():
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        try:
            key = str(st.secrets["GEMINI_API_KEY"]).strip()
        except Exception:
            key = ""
    if not key or genai is None:
        return None
    return genai.Client(api_key=key)


def fallback_reply(text: str, mode: str) -> str:
    replies = {
        "Neutral": f"Samajh aa raha hai yaar — tum keh rahe ho: {text}",
        "Comedy Trickster": f"Arre wah, is message ne toh dimaag ko unnecessary overtime de diya: {text}",
        "Chaos Mode": f"Bhai isme kuch toh gadbad hai… ya phir dabba kisi aur ke ghar pahunch gaya: {text}",
        "Wink & Whisper": f"Hmm, seedha message hai… par thoda sa attention bhi maang raha hai, hai na? {text}",
        "Unspoken Longing": f"Lagta hai words simple hain, par peeche thoda sa miss-you type feeling hai: {text}",
        "Velvet Shadows": f"Theek hai… par iske peeche kuch unsaid sa lag raha hai, idk yaar: {text}",
        "Whisperer": f"Matlab words se zyada feeling important hai — shayad tum kuch indirectly keh rahe ho: {text}",
    }
    return replies.get(mode, replies["Whisperer"])


def generate_reply(text: str, mode: str, history: list[dict[str, str]]) -> tuple[str, str | None]:
    client = get_client()
    if client is None:
        return fallback_reply(text, mode), "GEMINI_API_KEY is not configured; using a local fallback."
    context = "\n".join(f"{item['role']}: {item['content']}" for item in history[-8:])
    system = f"You are the AI Chat Middleman. Follow this prompt exactly:\n\n{PROMPTS.get(mode, PROMPTS['Whisperer'])}\n\nConversation context:\n{context}\n\nReturn only the transformed reply. Keep it short and natural."
    try:
        response = client.models.generate_content(model="gemini-3.5-flash-lite", contents=text, config=types.GenerateContentConfig(system_instruction=system, temperature=0.85, max_output_tokens=500))
        reply = (response.text or "").strip()
        if reply:
            return reply, None
        return fallback_reply(text, mode), "Gemini returned an empty response; using a local fallback."
    except Exception as exc:
        return fallback_reply(text, mode), f"Gemini request failed: {type(exc).__name__}. Check your Streamlit secret and model access."


def init_state() -> None:
    st.session_state.setdefault("user_id", uuid.uuid4().hex)
    st.session_state.setdefault("name", "")
    st.session_state.setdefault("age", 18)
    st.session_state.setdefault("gender", "Other")
    st.session_state.setdefault("mode", "Whisperer")
    st.session_state.setdefault("room_id", None)
    st.session_state.setdefault("room_code", "")
    st.session_state.setdefault("lobby_error", None)
    st.session_state.setdefault("last_error", None)


def inject_styles() -> None:
    st.markdown("""
    <style>
      .stApp { background: radial-gradient(circle at 10% 0%, #e5f6f1 0, transparent 34%), #f4f8f7; }
      [data-testid="stHeader"] { background: transparent; }
      [data-testid="stSidebar"] { background: #102b31 !important; border-right: 1px solid #2b5257; }
      [data-testid="stSidebar"] * { color: #eefcf9 !important; }
      [data-testid="stSidebar"] label, [data-testid="stSidebar"] .stCaption { color: #b8d3d0 !important; }
      [data-testid="stSidebar"] input, [data-testid="stSidebar"] textarea, [data-testid="stSidebar"] [data-baseweb="select"] > div { color: #16353c !important; background: #f7fffd !important; }
      [data-testid="stSidebar"] button { color: #16353c !important; background: #d8f0e9 !important; }
      .hero { padding: 1.1rem 1.25rem; border: 1px solid #dceae6; border-radius: 18px; background: rgba(255,255,255,.82); margin-bottom: 1rem; }
      .hero h1 { font-size: 1.55rem; margin: 0; color: #16353c; letter-spacing: -.04em; }
      .hero p { color: #557572; margin: .25rem 0 0; font-size: .85rem; }
      .status-card { padding: .75rem 1rem; border-radius: 14px; background: #e8f7f2; color: #28645d; border: 1px solid #c8e9df; }
      [data-testid="stChatMessage"] { border-radius: 16px; }
      @media (max-width: 600px) { .hero h1 { font-size: 1.25rem; } .block-container { padding: 1rem .75rem 5rem; } }
    </style>
    """, unsafe_allow_html=True)


def render_message(item: dict[str, str]) -> None:
    role = item["role"]
    with st.chat_message("user" if role == "You" else "assistant"):
        if role != "You":
            st.caption(f"{role} · {item.get('mode', st.session_state.mode)}")
        st.markdown(item["content"])


def main() -> None:
    st.set_page_config(page_title="AI Chat Middleman", page_icon="✨", layout="centered", initial_sidebar_state="expanded")
    init_db()
    init_state()
    inject_styles()

    with st.sidebar:
        st.markdown("## Chat settings")
        name = st.text_input("Your name", value=st.session_state.name, placeholder="Optional", key="name_input")
        st.session_state.name = name.strip() or "Anonymous"
        st.session_state.age = st.number_input("Your age", min_value=13, max_value=100, value=int(st.session_state.age), step=1)
        st.session_state.gender = st.selectbox("Your gender", ["Female", "Male", "Other"], index=["Female", "Male", "Other"].index(st.session_state.gender))
        selected_mode = st.selectbox("AI persona", list(MODE_SECTIONS), index=list(MODE_SECTIONS).index(st.session_state.mode), key="mode_select")
        st.session_state.mode = selected_mode
        st.caption("Create a private lobby and share its passcode with one friend.")
        if st.button("Leave chat", use_container_width=True):
            leave_room(st.session_state.user_id)
            st.session_state.room_id = None
            st.rerun()
        if st.button("New identity", use_container_width=True):
            leave_room(st.session_state.user_id)
            st.session_state.user_id = uuid.uuid4().hex
            st.session_state.room_id = None
            st.rerun()

    st.markdown(f"<div class='hero'><h1>✨ AI Chat Middleman</h1><p>Private two-way chat · {st.session_state.mode} · {st.session_state.name}</p></div>", unsafe_allow_html=True)

    if not st.session_state.room_id:
        create_tab, join_tab = st.tabs(["Create lobby", "Join with passcode"])
        with create_tab:
            st.markdown("### Start a private chat")
            st.write("Create a room, then send the six-character passcode to your friend.")
            if st.button("Create lobby", type="primary", use_container_width=True):
                room_id, code = create_lobby(st.session_state.user_id, st.session_state.name, int(st.session_state.age), st.session_state.gender)
                st.session_state.room_id = room_id
                st.session_state.room_code = code
                st.session_state.lobby_error = None
                st.rerun()
            if st.session_state.room_code:
                st.code(st.session_state.room_code, language=None)
                st.caption("Share this code with exactly one friend.")
        with join_tab:
            st.markdown("### Join a friend's lobby")
            join_code = st.text_input("Passcode", max_chars=6, placeholder="Example: A7K2QZ").strip().upper()
            if st.button("Join lobby", use_container_width=True):
                room_id, error = join_lobby(st.session_state.user_id, join_code, st.session_state.name, int(st.session_state.age), st.session_state.gender)
                if room_id:
                    st.session_state.room_id = room_id
                    st.session_state.room_code = join_code
                    st.session_state.lobby_error = None
                    st.rerun()
                st.session_state.lobby_error = error
            if st.session_state.lobby_error:
                st.error(st.session_state.lobby_error)
        st.stop()

    if st.session_state.room_code:
        st.markdown(f"<div class='status-card'>Share this lobby passcode with your friend: <strong>{st.session_state.room_code}</strong></div>", unsafe_allow_html=True)

    @st.fragment(run_every="2s")
    def live_chat() -> None:
        room_id = st.session_state.room_id
        partner = get_partner(room_id, st.session_state.user_id)
        member_count = room_member_count(room_id)
        if member_count < 2:
            st.info(f"Lobby created. Share passcode **{room_passcode(room_id)}** with your friend. Waiting for them to join…")
        else:
            st.success(f"Connected with {partner}. Send a message below.")
        for item in load_messages(room_id, st.session_state.user_id):
            render_message(item)

        prompt = st.chat_input("Type your message…", key="chat_input")
        if prompt and prompt.strip():
            text = prompt.strip()
            if text == "/mode":
                st.info("Choose a persona from the sidebar.")
                return
            history = load_messages(room_id, st.session_state.user_id)
            with st.spinner("Decoding the subtext…"):
                reply, warning = generate_reply(text, st.session_state.mode, history)
            save_message(room_id, st.session_state.user_id, st.session_state.name, text, reply, st.session_state.mode)
            if warning:
                st.session_state.last_error = warning
            st.rerun(scope="fragment")

    live_chat()
    if st.session_state.last_error:
        st.warning(st.session_state.last_error)


if __name__ == "__main__":
    main()
