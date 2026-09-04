# AI Chat Middleman

## Project Overview

A real-time WhatsApp-style chat application where messages between two users are creatively reinterpreted by AI before delivery. Built with React, Express, WebSockets, and Google Gemini AI.

**Last Updated:** November 17, 2025

## Key Features

### Core Functionality
- **Two-User Matching System**: Automatic pairing when two users connect
- **AI Message Transformation**: Every message is transformed by Gemini 2.5-flash-lite before delivery
- **Multiple AI Personas**: 7 different transformation styles (Whisperer, Chaos, Creepy, Romantic, Flirty, Humor, Neutral)
- **Real-Time Communication**: WebSocket-based instant messaging
- **Message Validation**: Minimum 10 words required per message
- **Cooldown System**: 10-second delay between messages to prevent spam
- **Chat Summarization**: AI-generated conversation summaries on demand
- **Temporary Sessions**: No persistent data storage - everything is ephemeral

### User Experience
- Mobile-first design optimized for thumb navigation
- WhatsApp-inspired familiar chat interface
- Waiting screen during user matching
- Word counter with validation feedback
- Typing indicators when AI processes messages
- Mode switching via `/mode` command
- Beautiful message bubbles with proper alignment
- Cooldown timer display

## Technical Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS + Shadcn UI components
- **State Management**: React hooks + TanStack Query
- **Real-time**: WebSocket with custom hook

### Backend
- **Server**: Express.js with TypeScript
- **Real-time**: ws (WebSocket server)
- **AI Integration**: Google Gemini AI (gemini-2.5-flash-lite)
- **Storage**: In-memory (MemStorage) - temporary sessions only

### Key Components

**Frontend:**
- `client/src/pages/chat.tsx` - Main chat interface
- `client/src/hooks/use-websocket.ts` - WebSocket connection manager
- `client/src/components/chat/` - All chat UI components
  - `waiting-screen.tsx` - Pre-match waiting interface
  - `chat-header.tsx` - Header with mode badge and actions
  - `message-list.tsx` - Scrollable message container
  - `message-bubble.tsx` - Individual message styling
  - `message-input.tsx` - Input with word validation
  - `mode-selector.tsx` - AI persona selection modal
  - `typing-indicator.tsx` - AI processing indicator

**Backend:**
- `server/routes.ts` - WebSocket server and message handling
- `server/storage.ts` - In-memory session and user management
- `server/gemini.ts` - AI transformation and summarization
- `shared/schema.ts` - TypeScript types and validation schemas

## AI Transformation System

### Persona Modes

1. **The Whisperer** (Default)
   - Subtle, nuanced interpretations
   - Analyzes subtext and hidden meanings
   - Adds spokesperson-style delivery

2. **Chaos Mode**
   - Chinese whisper effect
   - Twisted, scrambled, exaggerated messages
   - Intentionally confusing but recognizable

3. **Velvet Shadows**
   - Eerie, mysterious undertones
   - Whispered secrets and dark implications
   - Ominous calm delivery

4. **Unspoken Longing**
   - Romantic interpretation
   - Affection and tender emotions
   - Love-focused transformation

5. **Wink & Whisper**
   - Flirty and playful
   - Charming and seductive tone
   - Teasing compliments

6. **Comedy Trickster**
   - Humorous reinterpretation
   - Jokes and absurd comparisons
   - Funny while maintaining core message

7. **Neutral**
   - Minimal transformation
   - Grammar cleanup only
   - Original meaning preserved

### AI Guardrails
- 150-word maximum responses
- Simple 10th grader Indian English
- Emoji interpretation and description
- Profanity handling with mischievous corrections
- Context-based harmless "secret reveals"
- Message expansion (short) / condensing (long)

## Message Flow

1. User types message (10+ words)
2. Frontend validates word count
3. User sends message
4. Backend checks 10-second cooldown
5. Gemini AI transforms message using receiver's persona mode
6. **Both sender and receiver see AI-transformed version**
7. Original message is never displayed to sender
8. Cooldown timer starts

## Development

### Environment Variables
```
GEMINI_API_KEY - Google AI Studio API key (required)
SESSION_SECRET - Express session secret (auto-generated)
```

### Running the Application
```bash
npm run dev
```
Server runs on port 5000 with Vite dev server integrated.

### Testing
E2E tests verify:
- Two-user matching system
- WebSocket connectivity
- Message sending and AI transformation
- Word count validation
- Cooldown enforcement
- Bidirectional messaging

## Design Guidelines

The application follows strict design guidelines documented in `design_guidelines.md`:
- Mobile-first approach (375-428px width optimization)
- WhatsApp-inspired message bubbles
- Teal/cyan color scheme for primary actions
- Proper spacing and typography hierarchy
- No emoji usage (design choice)
- Shadcn component system without custom sizing overrides

## Known Limitations

1. **No Persistence**: All chats are temporary and lost on disconnect/refresh
2. **Two Users Only**: System matches pairs; no group chats
3. **No User Accounts**: Anonymous sessions only
4. **No Message History**: Past conversations not saved
5. **Single Language**: Optimized for English (10th grader Indian English)

## Recent Changes

### November 17, 2025
- Initial implementation complete
- All 7 AI persona modes working
- WebSocket-based real-time messaging
- E2E tests passing
- UI guidelines compliance verified
- Cooldown and validation systems functional

## Future Enhancement Ideas

Not currently implemented but could be added:
- Queue position indicator for waiting users
- Chat history export before disconnect
- Reconnection logic for accidental disconnects
- Admin panel for monitoring active sessions
- Additional persona modes
- Multi-language support
- Group chat support (3+ users)

## Project Structure

```
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── chat/       # Chat-specific components
│   │   │   └── ui/         # Shadcn UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities
│   │   └── App.tsx         # Root component
│   └── index.html          # Entry HTML
├── server/                 # Backend Express server
│   ├── routes.ts           # WebSocket + API routes
│   ├── storage.ts          # In-memory data storage
│   ├── gemini.ts           # AI transformation logic
│   └── index.ts            # Server entry point
├── shared/                 # Shared TypeScript types
│   └── schema.ts           # Data models and validation
└── design_guidelines.md    # UI/UX specifications
```

## Credits

- **AI Model**: Google Gemini 2.5-flash-lite
- **UI Components**: Shadcn UI
- **Icons**: Lucide React
- **Real-time**: ws (WebSocket library)
