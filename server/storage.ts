import { randomUUID } from "crypto";
import type { PersonaMode, UserProfile } from "@shared/schema";

export interface ChatSession {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: number;
  mode: PersonaMode;
  messages: SessionMessage[];
  user1Connected: boolean;
  user2Connected: boolean;
  summary?: string;
  lastActivityTime: number;
  cleanupTimeout?: NodeJS.Timeout;
}

export interface SessionMessage {
  id: string;
  senderId: string;
  originalContent: string;
  transformedContent: string;
  timestamp: number;
  mode: PersonaMode;
}

export interface UserSession {
  userId: string;
  socketId: string;
  sessionId?: string;
  lastMessageTime: number;
  profile?: UserProfile;
}

export interface IStorage {
  // User session management
  createUserSession(socketId: string, incomingUserId?: string): UserSession;
  getUserSession(userId: string): UserSession | undefined;
  getUserSessionBySocket(socketId: string): UserSession | undefined;
  removeUserSession(userId: string): void;

  // Chat session management
  createChatSession(user1Id: string, user2Id: string): ChatSession;
  getChatSession(sessionId: string): ChatSession | undefined;
  getChatSessionByUser(userId: string): ChatSession | undefined;
  removeChatSession(sessionId: string): void;
  markUserDisconnected(userId: string): void;
  markUserConnected(userId: string): void;
  updateActivityTime(sessionId: string): void;
  startCleanupTimer(sessionId: string): void;

  // Message management
  addMessage(sessionId: string, message: SessionMessage): void;
  getMessages(sessionId: string): SessionMessage[];
  setSummary(sessionId: string, summary: string): void;

  // Mode management
  updateUserMode(userId: string, mode: PersonaMode): void;
  getUserMode(userId: string): PersonaMode;

  // Profile management
  setUserProfile(userId: string, profile: UserProfile): void;
  getUserProfile(userId: string): UserProfile | undefined;

  // Cooldown management
  canSendMessage(userId: string): boolean;
  updateLastMessageTime(userId: string): void;

  // Waiting queue
  getWaitingUsers(): string[];
  addToWaitingQueue(userId: string): void;
  removeFromWaitingQueue(userId: string): void;
}

export class MemStorage implements IStorage {
  private userSessions: Map<string, UserSession>;
  private chatSessions: Map<string, ChatSession>;
  private waitingQueue: Set<string>;
  private userModes: Map<string, PersonaMode>;

  constructor() {
    this.userSessions = new Map();
    this.chatSessions = new Map();
    this.waitingQueue = new Set();
    this.userModes = new Map();
  }

  // User session management
  createUserSession(socketId: string, incomingUserId?: string): UserSession {
    // If userId provided and exists, update socketId
    if (incomingUserId && this.userSessions.has(incomingUserId)) {
      const session = this.userSessions.get(incomingUserId)!;
      session.socketId = socketId;
      return session;
    }

    // Else create new session (use incomingUserId if it was provided but not found, or generate new)
    const userId = incomingUserId || randomUUID();
    const session: UserSession = {
      userId,
      socketId,
      lastMessageTime: 0,
    };
    this.userSessions.set(userId, session);
    this.userModes.set(userId, "flexible"); // Default mode
    return session;
  }

  getUserSession(userId: string): UserSession | undefined {
    return this.userSessions.get(userId);
  }

  getUserSessionBySocket(socketId: string): UserSession | undefined {
    return Array.from(this.userSessions.values()).find(
      (session) => session.socketId === socketId,
    );
  }

  removeUserSession(userId: string): void {
    this.userSessions.delete(userId);
    this.userModes.delete(userId);
    this.removeFromWaitingQueue(userId);
  }

  // Chat session management
  createChatSession(user1Id: string, user2Id: string): ChatSession {
    const sessionId = randomUUID();
    const session: ChatSession = {
      id: sessionId,
      user1Id,
      user2Id,
      createdAt: Date.now(),
      mode: "flexible", // Initialize with default shared mode
      messages: [],
      user1Connected: true,
      user2Connected: true,
      lastActivityTime: Date.now(),
    };

    this.chatSessions.set(sessionId, session);

    // Update user sessions with chat session ID
    const user1Session = this.getUserSession(user1Id);
    const user2Session = this.getUserSession(user2Id);
    if (user1Session) user1Session.sessionId = sessionId;
    if (user2Session) user2Session.sessionId = sessionId;

    return session;
  }

  getChatSession(sessionId: string): ChatSession | undefined {
    return this.chatSessions.get(sessionId);
  }

  getChatSessionByUser(userId: string): ChatSession | undefined {
    return Array.from(this.chatSessions.values()).find(
      (session) => session.user1Id === userId || session.user2Id === userId,
    );
  }

  removeChatSession(sessionId: string): void {
    const session = this.getChatSession(sessionId);
    if (session) {
      // Clear cleanup timeout if exists
      if (session.cleanupTimeout) {
        clearTimeout(session.cleanupTimeout);
      }
      // Clear session ID from user sessions
      const user1Session = this.getUserSession(session.user1Id);
      const user2Session = this.getUserSession(session.user2Id);
      if (user1Session) delete user1Session.sessionId;
      if (user2Session) delete user2Session.sessionId;
    }
    this.chatSessions.delete(sessionId);
  }

  markUserDisconnected(userId: string): void {
    const session = this.getChatSessionByUser(userId);
    if (session) {
      if (session.user1Id === userId) {
        session.user1Connected = false;
      } else if (session.user2Id === userId) {
        session.user2Connected = false;
      }

      // If one or both users disconnected, start cleanup timer
      if (!session.user1Connected || !session.user2Connected) {
        this.startCleanupTimer(session.id);
      }
    }
  }

  markUserConnected(userId: string): void {
    const session = this.getChatSessionByUser(userId);
    if (session) {
      if (session.user1Id === userId) {
        session.user1Connected = true;
      } else if (session.user2Id === userId) {
        session.user2Connected = true;
      }

      // Cancel cleanup if both users are back
      if (
        session.user1Connected &&
        session.user2Connected &&
        session.cleanupTimeout
      ) {
        clearTimeout(session.cleanupTimeout);
        session.cleanupTimeout = undefined;
      }
    }
  }

  updateActivityTime(sessionId: string): void {
    const session = this.getChatSession(sessionId);
    if (session) {
      session.lastActivityTime = Date.now();
    }
  }

  startCleanupTimer(sessionId: string): void {
    const session = this.getChatSession(sessionId);
    if (session) {
      // Clear existing timeout if any
      if (session.cleanupTimeout) {
        clearTimeout(session.cleanupTimeout);
      }

      // Set 5 minute timeout
      session.cleanupTimeout = setTimeout(
        () => {
          console.log(`Cleaning up inactive session ${sessionId}`);
          this.removeChatSession(sessionId);
        },
        5 * 60 * 1000,
      ); // 5 minutes
    }
  }

  // Message management
  addMessage(sessionId: string, message: SessionMessage): void {
    const session = this.getChatSession(sessionId);
    if (session) {
      session.messages.push(message);
    }
  }

  getMessages(sessionId: string): SessionMessage[] {
    const session = this.getChatSession(sessionId);
    return session?.messages || [];
  }

  setSummary(sessionId: string, summary: string): void {
    const session = this.getChatSession(sessionId);
    if (session) {
      session.summary = summary;
    }
  }

  // Profile management
  setUserProfile(userId: string, profile: UserProfile): void {
    const session = this.getUserSession(userId);
    if (session) {
      session.profile = profile;
    }
  }

  getUserProfile(userId: string): UserProfile | undefined {
    const session = this.getUserSession(userId);
    return session?.profile;
  }

  // Mode management
  updateUserMode(userId: string, mode: PersonaMode): void {
    this.userModes.set(userId, mode);

    // Update in chat session if exists - SHARED MODE
    const chatSession = this.getChatSessionByUser(userId);
    if (chatSession) {
      chatSession.mode = mode;
    }
  }

  getUserMode(userId: string): PersonaMode {
    // If in a session, return the session's mode
    const chatSession = this.getChatSessionByUser(userId);
    if (chatSession) {
      return chatSession.mode;
    }
    // Fallback to user preference (mainly for waiting/new users)
    return this.userModes.get(userId) || "flexible";
  }

  // Cooldown management (10 seconds between messages)
  canSendMessage(userId: string): boolean {
    const session = this.getUserSession(userId);
    if (!session) return false;

    const now = Date.now();
    const timeSinceLastMessage = now - session.lastMessageTime;
    return timeSinceLastMessage >= 10000 || session.lastMessageTime === 0;
  }

  updateLastMessageTime(userId: string): void {
    const session = this.getUserSession(userId);
    if (session) {
      session.lastMessageTime = Date.now();
    }
  }

  // Waiting queue
  getWaitingUsers(): string[] {
    return Array.from(this.waitingQueue);
  }

  addToWaitingQueue(userId: string): void {
    this.waitingQueue.add(userId);
  }

  removeFromWaitingQueue(userId: string): void {
    this.waitingQueue.delete(userId);
  }
}

export const storage = new MemStorage();
