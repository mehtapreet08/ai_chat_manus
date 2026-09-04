import { z } from "zod";

// AI Persona Modes
export const personaModes = [
  "sherlock",
  "aunty",
  "flirty",
  "flexible",
  "neutral",
  "chinese_whisper",
  "khayali_pulao"
] as const;

export type PersonaMode = typeof personaModes[number];

export const personaDisplayNames: Record<PersonaMode, string> = {
  "sherlock": "Sherlock Holmes First Copy",
  "aunty": "Misinterpreting Aunty",
  "flirty": "Flirty Romantic Birds",
  "flexible": "Flexible AI",
  "neutral": "Neutral",
  "chinese_whisper": "Chinese Whisper Mode",
  "khayali_pulao": "Khayali Pulao Mode"
};

export const personaDescriptions: Record<PersonaMode, string> = {
  "sherlock": "Adds insightful (and often suspicious) commentary to your messages.",
  "aunty": "Twists your words into hilarious, dramatic gossip.",
  "flirty": "Turns every message into a sweet, romantic whisper.",
  "flexible": "Surprise! The AI chooses the best persona for the moment.",
  "neutral": "Minimal transformation, mostly unchanged.",
  "chinese_whisper": "Completely misunderstands and replaces words to change meaning.",
  "khayali_pulao": "Turns your messages into elaborate daydreams before returning to reality."
};

// Message types
export const messageTypes = ["sent", "received", "ai-interpreted", "summary", "system"] as const;
export type MessageType = typeof messageTypes[number];

// Message schema
export interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  label?: string;
  mode?: PersonaMode;
}

export const insertMessageSchema = z.object({
  content: z.string().min(1),
  type: z.enum(messageTypes)
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;

// User Profile Schema
export interface UserProfile {
  gender: 'male' | 'female' | 'other';
  age: number;
  name?: string;
}

// WebSocket event types
export const wsEventTypes = [
  "waiting",
  "matched",
  "message",
  "ai-response",
  "mode-change",
  "summary",
  "disconnect",
  "error",
  "cooldown",
  "typing",
  "profile-complete",
  "partner-disconnected",
  "partner-reconnected",
  "profile-setup"
] as const;

export type WSEventType = typeof wsEventTypes[number];

// WebSocket message payloads
export interface WSMessage {
  type: WSEventType;
  payload?: any;
}

export interface ProfileCompletePayload {
  userLabel: string;
}

export interface WaitingPayload {
  position?: number;
}

export interface MatchedPayload {
  sessionId: string;
  partnerId: string;
}

export interface MessagePayload {
  messageId: string;
  content: string;
  timestamp: number;
}

export interface AIResponsePayload {
  messageId: string;
  originalContent?: string;
  transformedContent: string;
  mode: PersonaMode;
  timestamp: number;
}

export interface ModeChangePayload {
  mode: PersonaMode;
  userId: string;
}

export interface SummaryPayload {
  messageId: string;
  summary: string;
  timestamp: number;
}

export interface CooldownPayload {
  remainingSeconds: number;
}

export interface TypingPayload {
  isTyping: boolean;
}

// User Session Interface with Profile
export interface UserSession {
  userId: string;
  socketId: string;
  sessionId?: string;
  lastMessageTime: number;
  profile?: UserProfile;
}


// Validation schemas
export const sendMessageSchema = z.object({
  content: z.string()
    .min(1, "Message must be at least 1 word") // Changed min length to 1
    .refine((val) => val.trim().split(/\s+/).length >= 1, { // Changed min words to 1
      message: "Message must contain at least 1 word"
    })
});

export const changeModeSchema = z.object({
  mode: z.enum(personaModes)
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ChangeModeInput = z.infer<typeof changeModeSchema>;
