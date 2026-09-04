document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');
    const sessionList = document.getElementById('session-list');
    const btnNewSession = document.getElementById('btn-new-session');
    const btnExport = document.getElementById('btn-export');
    const btnImport = document.getElementById('btn-import');
    const importFile = document.getElementById('import-file');
    const btnToggleTheme = document.getElementById('btn-toggle-theme');

    let currentSessionId = null;
    let messageHistory = [];
    let isProcessing = false;

    // --- Init ---
    loadSessionList();

    // --- Event Listeners ---

    btnSend.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    btnNewSession.addEventListener('click', () => {
        currentSessionId = null;
        messageHistory = [];
        clearLanes();
        appendMessage('Analyst', 'Starting new session... Ready for your idea.');
    });

    btnExport.addEventListener('click', () => {
        if (!currentSessionId) return alert('No active session to export.');
        window.open(`/api/sessions/${currentSessionId}`, '_blank');
    });

    btnImport.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/import', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.sessionId) {
                loadSession(data.sessionId);
                loadSessionList();
            } else {
                alert('Import failed: ' + data.error);
            }
        } catch (err) {
            alert('Import error: ' + err);
        }
        importFile.value = ''; // Reset
    });

    btnToggleTheme.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        document.body.classList.toggle('light-mode');
    });

    // --- Core Logic ---

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text || isProcessing) return;

        // UI Update
        appendMessage('user', text);
        userInput.value = '';
        setProcessing(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: messageHistory,
                    sessionId: currentSessionId
                })
            });

            const data = await res.json();

            if (data.sessionId) {
                currentSessionId = data.sessionId;
            }

            if (data.newMessages) {
                // Update local history
                messageHistory.push({ role: 'user', content: text });

                // Display agents strictly in order with slight delay for effect
                for (const msg of data.newMessages) {
                    messageHistory.push(msg);
                    await new Promise(r => setTimeout(r, 600)); // typing effect delay
                    appendMessage(msg.role, msg.content);
                }
            }

            loadSessionList(); // Refresh list to show latest timestamp
        } catch (err) {
            console.error(err);
            appendMessage('Analyst', 'Error communicating with agents. Please try again.');
        } finally {
            setProcessing(false);
        }
    }

    function appendMessage(role, content) {
        let laneId = '';
        if (role === 'user') laneId = 'lane-user-content';
        else if (role === 'Analyst') laneId = 'lane-analyst-content';
        else if (role === 'Visionary') laneId = 'lane-visionary-content';
        else if (role === 'Realist') laneId = 'lane-realist-content';
        else return; // Unknown role

        const lane = document.getElementById(laneId);
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = content; // Text content prevents XSS, basic implementation

        lane.appendChild(bubble);
        lane.scrollTop = lane.scrollHeight;
    }

    function clearLanes() {
        document.querySelectorAll('.lane-content').forEach(el => el.innerHTML = '');
    }

    function setProcessing(state) {
        isProcessing = state;
        btnSend.disabled = state;
        btnSend.textContent = state ? 'Thinking...' : 'Send';
    }

    async function loadSessionList() {
        try {
            const res = await fetch('/api/sessions');
            const sessions = await res.json();
            sessionList.innerHTML = '';

            sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Newest first

            sessions.forEach(sess => {
                const div = document.createElement('div');
                div.className = 'session-item';
                div.textContent = `${sess.timestamp.split('.')[0]} - ${sess.preview.substring(0, 20)}...`;
                div.onclick = () => loadSession(sess.id);
                if (sess.id === currentSessionId) div.classList.add('active');
                sessionList.appendChild(div);
            });
        } catch (err) {
            console.error('Failed to load sessions', err);
        }
    }

    async function loadSession(id) {
        try {
            const res = await fetch(`/api/sessions/${id}`);
            const data = await res.json();

            if (data.messages) {
                currentSessionId = data.id;
                messageHistory = data.messages;
                clearLanes();

                // Replay messages
                data.messages.forEach(msg => {
                    appendMessage(msg.role, msg.content);
                });

                // Update active state in list
                document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
                loadSessionList(); // Re-render to highlight correct one (lazy way)
            }
        } catch (err) {
            console.error('Failed to load session', err);
        }
    }
});
