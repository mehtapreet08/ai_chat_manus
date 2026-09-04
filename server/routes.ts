import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { transformMessage, summarizeConversation } from "./gemini";
import type { WSMessage, PersonaMode } from "@shared/schema";
import { randomUUID } from "crypto";
import { parse } from "url";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server on /ws path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Map to track WebSocket connections by user ID
  const connections = new Map<string, WebSocket>();

  wss.on("connection", (ws: WebSocket, req) => {
    console.log("New WebSocket connection");

    // Parse userId from query string
    const { query } = parse(req.url || "", true);
    const incomingUserId = query.userId as string;

    // Create or get user session
    const userSession = storage.createUserSession(Math.random().toString(), incomingUserId);
    const userId = userSession.userId;
    connections.set(userId, ws);

    console.log(`User ${userId} connected`);

    // Check if user has existing chat session
    const existingSession = storage.getChatSessionByUser(userId);

    if (existingSession) {
      // Reconnect to existing session
      storage.markUserConnected(userId);
      console.log(
        `User ${userId} reconnected to session ${existingSession.id}`,
      );

      // Send matched event with existing messages
      const partnerId =
        existingSession.user1Id === userId
          ? existingSession.user2Id
          : existingSession.user1Id;

      // Notify partner about reconnection
      const partnerWs = connections.get(partnerId);
      if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
        send(partnerWs, { type: "partner-reconnected", payload: {} });
      }

      send(ws, {
        type: "matched",
        payload: {
          sessionId: existingSession.id,
          partnerId,
        },
      });

      // Send all existing messages to reconnected user
      const messages = storage.getMessages(existingSession.id);
      messages.forEach((msg) => {
        const isSender = msg.senderId === userId;
        let contentToShow = msg.transformedContent;
        let senderLabel = "Person 1"; // Default fallback

        // Get profiles for logic
        const msgSenderProfile = storage.getUserProfile(msg.senderId);
        const msgSenderName = msgSenderProfile?.name || (existingSession.user1Id === msg.senderId ? "Person 1" : "Person 2");

        // Determine labels and content
        if (isSender) {
            senderLabel = "You";
            // For Sherlock mode, the sender sees their original content
            if (msg.mode === "sherlock") {
              contentToShow = msg.originalContent;
            }
        } else {
             // If I am receiver, I see partner's label (Name or Person X)
             senderLabel = msgSenderName;
             // Receiver always sees transformed content (Sherlock analysis or Twisted text)
             contentToShow = msg.transformedContent;
        }

        send(ws, {
          type: "ai-response",
          payload: {
            messageId: msg.id,
            transformedContent: contentToShow,
            mode: msg.mode,
            timestamp: msg.timestamp,
            senderLabel,
          },
        });
      });
    } else {
      // Add to waiting queue and try to match
      storage.addToWaitingQueue(userId);
      tryMatchUsers();
    }

    ws.on("message", async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await handleWebSocketMessage(userId, message, ws);
      } catch (error) {
        console.error("Error processing message:", error);
        sendError(ws, "Failed to process message");
      }
    });

    ws.on("close", () => {
      console.log(`User ${userId} disconnected`);
      handleDisconnect(userId);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });
  });

  async function handleWebSocketMessage(
    userId: string,
    message: WSMessage,
    ws: WebSocket,
  ) {
    switch (message.type) {
      case "profile-setup":
        handleProfileSetup(userId, message.payload);
        break;

      case "message":
        await handleMessage(userId, message.payload.content);
        break;

      case "mode-change":
        handleModeChange(userId, message.payload.mode);
        break;

      case "summary":
        await handleSummary(userId);
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  function handleProfileSetup(
    userId: string,
    payload: { gender: "male" | "female" | "other"; age: number, name?: string },
  ) {
    storage.setUserProfile(userId, payload);

    // Determine user label (Person 1 or Person 2)
    const chatSession = storage.getChatSessionByUser(userId);
    let userLabel = payload.name || "Person 1";

    if (chatSession) {
       userLabel = payload.name || (chatSession.user1Id === userId ? "Person 1" : "Person 2");

       // We also need to notify the PARTNER that the profile is complete/updated so they can see the name
       const partnerId = chatSession.user1Id === userId ? chatSession.user2Id : chatSession.user1Id;
       // In a real app we might want to broadcast this profile update event
    }

    const ws = connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      send(ws, {
        type: "profile-complete",
        payload: { userLabel },
      });
    }
  }

  async function handleMessage(senderId: string, content: string) {
    // Check cooldown
    if (!storage.canSendMessage(senderId)) {
      const senderWs = connections.get(senderId);
      if (senderWs) {
        send(senderWs, {
          type: "cooldown",
          payload: { remainingSeconds: 10 },
        });
      }
      return;
    }

    // Get chat session
    const chatSession = storage.getChatSessionByUser(senderId);
    if (!chatSession) {
      return;
    }

    // Determine receiver
    const receiverId =
      chatSession.user1Id === senderId
        ? chatSession.user2Id
        : chatSession.user1Id;

    // Get shared session mode for transformation
    const sharedMode = chatSession.mode;

    // Update cooldown IMMEDIATELY before AI processing
    storage.updateLastMessageTime(senderId);

    // Send typing indicator to receiver
    const receiverWs = connections.get(receiverId);
    if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
      send(receiverWs, {
        type: "typing",
        payload: { isTyping: true },
      });
    }

    try {
      // Get conversation history for context
      const messages = storage.getMessages(chatSession.id);
      const conversationHistory = messages.map((msg) => ({
        role: (msg.senderId === senderId ? "sender" : "receiver") as
          | "sender"
          | "receiver",
        content: msg.originalContent,
      }));

      // Get profiles for context
      const senderProfile = storage.getUserProfile(senderId);
      const receiverProfile = storage.getUserProfile(receiverId);

      // Check if it's time to summarize
      if (messages.length > 0 && messages.length % 40 === 0) {
        const summary = await summarizeConversation(
          messages.map((m) => m.originalContent),
        );
        storage.setSummary(chatSession.id, summary);
      }

      // Transform message with AI (including conversation context and profiles)
      const transformedContent = await transformMessage(
        content,
        sharedMode,
        conversationHistory,
        senderProfile,
        receiverProfile,
        chatSession.summary,
      );

      // Create message
      const messageId = randomUUID();
      const timestamp = Date.now();

      // Store message with both original and transformed content
      storage.addMessage(chatSession.id, {
        id: messageId,
        senderId,
        originalContent: content,
        transformedContent,
        timestamp,
        mode: sharedMode,
      });

      // Update activity time
      storage.updateActivityTime(chatSession.id);

      // Determine labels
      // Sender label: "You"
      // Receiver label: Sender's Name OR "Person 1/2"
      const senderName = senderProfile?.name || (chatSession.user1Id === senderId ? "Person 1" : "Person 2");

      // Send to SENDER
      const senderWs = connections.get(senderId);
      if (senderWs && senderWs.readyState === WebSocket.OPEN) {
        // SHERLOCK LOGIC: Sender sees ORIGINAL content
        const contentForSender = sharedMode === "sherlock" ? content : transformedContent;

        send(senderWs, {
          type: "ai-response",
          payload: {
            messageId,
            transformedContent: contentForSender,
            mode: sharedMode,
            timestamp,
            senderLabel: "You",
          },
        });

        // Also send cooldown notification
        send(senderWs, {
          type: "cooldown",
          payload: { remainingSeconds: 10 },
        });
      }

      // Send to RECEIVER
      if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
        // SHERLOCK LOGIC: Receiver sees TRANSFORMED content (Original + Analysis)
        // OTHER MODES: Receiver sees TRANSFORMED content
        send(receiverWs, {
          type: "ai-response",
          payload: {
            messageId,
            transformedContent,
            mode: sharedMode,
            timestamp,
            senderLabel: senderName,
          },
        });
      }
    } catch (error) {
      console.error("Error transforming message:", error);

      // Send error to sender
      const senderWs = connections.get(senderId);
      if (senderWs) {
        sendError(senderWs, "Failed to transform message");
      }
    }
  }

  function handleModeChange(userId: string, mode: PersonaMode) {
    // Update mode in storage (which updates the shared session mode)
    storage.updateUserMode(userId, mode);

    // Get chat session
    const chatSession = storage.getChatSessionByUser(userId);

    // Send confirmation to the user who changed mode
    const ws = connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      send(ws, {
        type: "mode-change",
        payload: { mode, userId },
      });
    }

    // Notify partner about mode change (they now share this mode)
    if (chatSession) {
      const partnerId =
        chatSession.user1Id === userId
          ? chatSession.user2Id
          : chatSession.user1Id;

      const partnerWs = connections.get(partnerId);
      if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
        send(partnerWs, {
          type: "mode-change",
          payload: { mode, userId: partnerId },
        });
      }
    }
  }

  async function handleSummary(userId: string) {
    const chatSession = storage.getChatSessionByUser(userId);
    if (!chatSession) {
      return;
    }

    try {
      // Get all messages (both original and transformed for context)
      const messages = storage.getMessages(chatSession.id);

      if (messages.length === 0) {
        return;
      }

      // Use BOTH original and transformed content for better summaries
      const messageTexts = messages.map(
        (m) =>
          `Original: ${m.originalContent}\nTransformed (${m.mode}): ${m.transformedContent}`,
      );

      // Generate summary
      const summary = await summarizeConversation(messageTexts);

      const messageId = randomUUID();
      const timestamp = Date.now();

      // CRITICAL FIX: Send summary to BOTH users
      const user1Ws = connections.get(chatSession.user1Id);
      const user2Ws = connections.get(chatSession.user2Id);

      const summaryMessage: WSMessage = {
        type: "summary",
        payload: {
          messageId,
          summary,
          timestamp,
        },
      };

      if (user1Ws && user1Ws.readyState === WebSocket.OPEN) {
        send(user1Ws, summaryMessage);
      }
      if (user2Ws && user2Ws.readyState === WebSocket.OPEN) {
        send(user2Ws, summaryMessage);
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      const ws = connections.get(userId);
      if (ws) {
        sendError(ws, "Failed to generate summary");
      }
    }
  }

  function tryMatchUsers() {
    const waitingUsers = storage.getWaitingUsers();

    if (waitingUsers.length >= 2) {
      // Match first two users
      const user1Id = waitingUsers[0];
      const user2Id = waitingUsers[1];

      // Remove from waiting queue
      storage.removeFromWaitingQueue(user1Id);
      storage.removeFromWaitingQueue(user2Id);

      // Create chat session
      const chatSession = storage.createChatSession(user1Id, user2Id);

      console.log(`Matched users ${user1Id} and ${user2Id}`);

      // Notify both users
      const user1Ws = connections.get(user1Id);
      const user2Ws = connections.get(user2Id);

      // Get names
      const user1Profile = storage.getUserProfile(user1Id);
      const user2Profile = storage.getUserProfile(user2Id);

      // Provide partner ID but we need names now too.
      // The `matched` event payload doesn't explicitly carry name,
      // but `handleMessage` uses it. The header might want it.
      // Let's stick to basic match first.

      const matchedMessage: WSMessage = {
        type: "matched",
        payload: {
          sessionId: chatSession.id,
          partnerId: "",
        },
      };

      if (user1Ws && user1Ws.readyState === WebSocket.OPEN) {
        send(user1Ws, {
          ...matchedMessage,
          payload: { ...matchedMessage.payload, partnerId: user2Id },
        });
      }
      if (user2Ws && user2Ws.readyState === WebSocket.OPEN) {
        send(user2Ws, {
          ...matchedMessage,
          payload: { ...matchedMessage.payload, partnerId: user1Id },
        });
      }
    }
  }

  function handleDisconnect(userId: string) {
    // Get chat session if exists
    const chatSession = storage.getChatSessionByUser(userId);

    if (chatSession) {
      // Mark user as disconnected (don't delete session yet)
      storage.markUserDisconnected(userId);

      // Notify partner
      // Wait a bit? No, the `markUserDisconnected` starts the timer.
      // But the user requested: "disconnects 10 second later after the net is not connected"
      // The frontend will see "partner-disconnected" immediately here.
      // To implement the "10 second later" requirement visually, we can:
      // 1. Delay sending this message here.
      // 2. OR The frontend can delay showing it.

      // Let's try delaying the notification here.
      setTimeout(() => {
         // Check if user reconnected
         const session = storage.getUserSession(userId);
         const currentChatSession = storage.getChatSessionByUser(userId);

         // If user is still disconnected AND still in the same chat session
         // We need to check if they reconnected.
         // But `connections` map was deleted in `handleDisconnect`.
         // If they reconnected, `connections` would have a new entry.

         // Actually `handleDisconnect` removes from `connections`.
         // If they reconnect, `registerRoutes` puts them back in `connections`.

         if (!connections.has(userId) && currentChatSession) {
             const partnerId =
                currentChatSession.user1Id === userId
                  ? currentChatSession.user2Id
                  : currentChatSession.user1Id;

              const partnerWs = connections.get(partnerId);
              if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
                send(partnerWs, { type: "partner-disconnected", payload: {} });
              }
         }
      }, 10000); // 10 seconds delay for the notification
    }

    // Remove from connections map immediately so we know they are gone
    connections.delete(userId);

    // But DO NOT remove user session immediately if we want them to be able to reconnect with same ID
    // `storage.removeUserSession(userId)` was deleting the session data.
    // We should keep it for at least the cleanup duration (5 mins).
    // storage.removeUserSession(userId); // <-- REMOVED THIS to allow reconnection

    // Remove from waiting queue if present
    storage.removeFromWaitingQueue(userId);
  }

  function send(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function sendError(ws: WebSocket, error: string) {
    send(ws, {
      type: "error",
      payload: { error },
    });
  }

  return httpServer;
}
