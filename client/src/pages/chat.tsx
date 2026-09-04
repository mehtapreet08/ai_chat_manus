import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Instagram, LogOut, Menu, Send, Sparkles, X } from "lucide-react";
import { useLocation } from "wouter";
import { personaDescriptions, personaDisplayNames, personaModes, type Message, type PersonaMode } from "@shared/schema";
import { ProfileSetup } from "@/components/chat/profile-setup";
import { useWebSocket } from "@/hooks/use-websocket";

function time(value: number) { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(value); }

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [showModes, setShowModes] = useState(false);
  const [selectedMode, setSelectedMode] = useState<PersonaMode>("sherlock");
  const [menuOpen, setMenuOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const addMessage = (message: Message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
  const socket = useWebSocket({ onEvent: addMessage });
  const words = useMemo(() => draft.trim() ? draft.trim().split(/\s+/).length : 0, [draft]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, socket.typing]);
  useEffect(() => { if (!summaryLoading) return; const timer = setTimeout(() => setSummaryLoading(false), 1200); return () => clearTimeout(timer); }, [summaryLoading]);

  const send = () => {
    const content = draft.trim();
    if (!content || socket.cooldown > 0 || !socket.isConnected) return;
    if (content === "/mode") { setShowModes(true); setDraft(""); return; }
    if (content === "/summarize") { setSummaryLoading(true); socket.requestSummary(); setDraft(""); return; }
    if (!socket.sendMessage(content)) return;
    addMessage({ id: crypto.randomUUID(), type: "sent", content, timestamp: Date.now() });
    setDraft("");
  };
  const chooseMode = () => { socket.changeMode(selectedMode); addMessage({ id: crypto.randomUUID(), type: "system", content: `Mode changed to ${personaDisplayNames[selectedMode]}`, timestamp: Date.now() }); setShowModes(false); };

  if (!socket.isConnected) return <div className="state-screen"><div className="loader" /><h1>Connecting…</h1><p>Setting up your private chat.</p></div>;
  if (socket.needsProfile) return <ProfileSetup onComplete={socket.sendProfile} />;
  if (!socket.isMatched) return <div className="state-screen"><div className="orbit"><Sparkles size={26} /></div><h1>Finding your chat partner</h1><p>Waiting for another user to connect.</p><small>Messages will be transformed by the AI middleman.</small></div>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><h1>AI Chat Middleman</h1><p><span className="online-dot" /> Connected · chatting as {socket.userLabel || "You"}</p></div></div>
      <div className="header-actions">
        <span className="mode-pill">{personaDisplayNames[socket.mode]}</span>
        <button className="icon-button desktop-only" title="Instagram" onClick={() => setLocation("/instagram")}><Instagram size={17} /></button>
        <button className="icon-button desktop-only" title="Summarize" onClick={() => { setSummaryLoading(true); socket.requestSummary(); }}><FileText size={17} /></button>
        <button className="icon-button" title="Menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={18} /></button>
      </div>
      {menuOpen && <div className="quick-menu"><button onClick={() => { setSummaryLoading(true); socket.requestSummary(); setMenuOpen(false); }}><FileText size={16} /> Summarize chat</button><button onClick={() => setLocation("/instagram")}><Instagram size={16} /> Instagram mode</button><button className="danger" onClick={socket.disconnect}><LogOut size={16} /> Disconnect</button></div>}
    </header>

    <section className="chat-scroll" aria-live="polite">
      <div className="welcome-card"><div className="welcome-icon"><Sparkles size={20} /></div><div><strong>Welcome to the middleman</strong><p>Pick a persona and let the AI decode the subtext.</p></div></div>
      {messages.map((message) => <article className={`message-row ${message.type}`} key={message.id}><div className="message-bubble">{(message.type === "ai-interpreted" || message.type === "summary") && <div className="message-label">{message.label || "AI Middleman"}{message.mode ? ` · ${personaDisplayNames[message.mode]}` : ""}</div>}<div className="message-content">{message.content}</div><time>{time(message.timestamp)}</time></div></article>)}
      {socket.typing && <div className="typing"><span /><span /><span /> AI is thinking</div>}
      <div ref={endRef} />
    </section>

    <footer className="composer-wrap"><div className="command-hint"><button onClick={() => setShowModes(true)}>Choose persona</button><span>Try <b>/mode</b> or <b>/summarize</b></span></div><div className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Type your message…" rows={1} maxLength={1000} /><button className="send-button" onClick={send} disabled={!draft.trim() || socket.cooldown > 0} title="Send"><Send size={18} /><span>Send</span></button></div><div className={`composer-meta ${words > 0 ? "valid" : ""}`}><span>{words ? `${words} word${words === 1 ? "" : "s"}` : "Messages are private and temporary"}</span>{socket.cooldown > 0 && <span>Please wait {socket.cooldown}s</span>}</div></footer>

    {showModes && <div className="modal-backdrop" onClick={() => setShowModes(false)}><section className="mode-modal" onClick={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">AI PERSONA</span><h2>How should it sound?</h2></div><button className="icon-button" onClick={() => setShowModes(false)}><X size={18} /></button></div><div className="mode-list">{personaModes.map((item) => <button className={`mode-option ${selectedMode === item ? "selected" : ""}`} key={item} onClick={() => setSelectedMode(item)}><span className="radio" /> <span><strong>{personaDisplayNames[item]}</strong><small>{personaDescriptions[item]}</small></span></button>)}</div><button className="primary-button" onClick={chooseMode}>Switch mode</button></section></div>}
    {summaryLoading && <div className="loading-chip"><span className="loader small" /> Summarizing conversation…</div>}
  </main>;
}
