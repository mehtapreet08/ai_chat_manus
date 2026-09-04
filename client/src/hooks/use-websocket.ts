import { useCallback, useEffect, useRef, useState } from "react";
import type { AIResponsePayload, Message, PersonaMode, WSMessage } from "@shared/schema";

interface Options {
  onEvent?: (message: Message) => void;
}

export function useWebSocket({ onEvent }: Options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(true);
  const [userLabel, setUserLabel] = useState("");
  const [mode, setMode] = useState<PersonaMode>("sherlock");
  const [typing, setTyping] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const generationRef = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const emit = useCallback((message: Message) => onEventRef.current?.(message), []);

  useEffect(() => {
    stoppedRef.current = false;
    const userId = sessionStorage.getItem("userId") ?? crypto.randomUUID();
    sessionStorage.setItem("userId", userId);

    const connect = () => {
      if (stoppedRef.current) return;
      const generation = ++generationRef.current;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws?userId=${userId}`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (generation !== generationRef.current || stoppedRef.current) return;
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        if (generation !== generationRef.current || stoppedRef.current) return;
        try {
          const packet = JSON.parse(event.data) as WSMessage;
          const payload = packet.payload ?? {};
          switch (packet.type) {
            case "profile-complete": setUserLabel(payload.userLabel ?? ""); setNeedsProfile(false); break;
            case "matched":
              setIsMatched(true);
              emit({ id: crypto.randomUUID(), type: "system", content: "Connected to another user!", timestamp: Date.now() });
              break;
            case "ai-response": {
              const data = payload as AIResponsePayload & { senderLabel?: string };
              setTyping(false);
              emit({ id: data.messageId, type: "ai-interpreted", content: data.transformedContent, timestamp: data.timestamp, label: data.senderLabel ?? "AI Middleman", mode: data.mode });
              break;
            }
            case "summary": emit({ id: payload.messageId, type: "summary", content: payload.summary, timestamp: payload.timestamp, label: "Conversation Summary" }); break;
            case "mode-change": setMode(payload.mode); break;
            case "cooldown": setCooldown(Math.max(0, Number(payload.remainingSeconds) || 0)); break;
            case "typing": setTyping(Boolean(payload.isTyping)); break;
            case "partner-disconnected": setIsMatched(false); emit({ id: crypto.randomUUID(), type: "system", content: "Your partner has disconnected. They have 5 minutes to reconnect.", timestamp: Date.now() }); break;
            case "partner-reconnected": emit({ id: crypto.randomUUID(), type: "system", content: "Your partner has reconnected!", timestamp: Date.now() }); break;
          }
        } catch { emit({ id: crypto.randomUUID(), type: "system", content: "Could not read a server update.", timestamp: Date.now() }); }
      };

      socket.onclose = () => {
        if (generation !== generationRef.current || stoppedRef.current) return;
        setIsConnected(false);
        if (!reconnectRef.current) reconnectRef.current = setTimeout(() => { reconnectRef.current = null; connect(); }, 2000);
      };
      socket.onerror = () => socket.close();
    };
    connect();

    const cooldownTimer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => {
      stoppedRef.current = true;
      generationRef.current += 1;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      clearInterval(cooldownTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [emit]);

  const send = useCallback((packet: WSMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) { socket.send(JSON.stringify(packet)); return true; }
    return false;
  }, []);

  return {
    isConnected, isMatched, needsProfile, userLabel, mode, typing, cooldown,
    sendProfile: (gender: "male" | "female" | "other", age: number, name?: string) => send({ type: "profile-setup", payload: { gender, age, name } }),
    sendMessage: (content: string) => send({ type: "message", payload: { content } }),
    changeMode: (nextMode: PersonaMode) => { setMode(nextMode); send({ type: "mode-change", payload: { mode: nextMode } }); },
    requestSummary: () => send({ type: "summary", payload: {} }),
    disconnect: () => { stoppedRef.current = true; socketRef.current?.close(); setIsConnected(false); setIsMatched(false); }
  };
}
