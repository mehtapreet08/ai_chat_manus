# AI Chat Middleman — Streamlit

This version runs from `streamlit_app.py`, keeps the supplied prompt asset unchanged, and supports a private two-person lobby. A host enters name, age, and gender, creates a six-character passcode, and shares it with one friend. The friend enters the passcode and joins the same room. Matching and messages are stored in a small SQLite database using WAL mode and transaction locks.

## Run locally

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Deploy on Streamlit Community Cloud

1. Push this project to a GitHub repository.
2. Open [share.streamlit.io](https://share.streamlit.io/).
3. Choose the repository and set the main file to `streamlit_app.py`.
4. Add `GEMINI_API_KEY` under **Advanced settings → Secrets** if AI responses should use Gemini.
5. Deploy.

Without a Gemini key, the app stays usable with local fallback replies so the UI and prompt modes can still be tested.

## Shared chat notes

The Streamlit deployment must use a persistent writable filesystem for the SQLite database. Streamlit Community Cloud provides this during a running app, but its local filesystem is not a permanent database across app restarts. For durable lobby and chat history, replace the SQLite functions with a hosted database.

The sidebar uses explicit dark-theme colors, so its labels, inputs, select box, and buttons remain visible when the app is in dark mode.
