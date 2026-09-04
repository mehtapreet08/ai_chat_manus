# Design Guidelines: AI Chat Middleman Application

## Design Approach

**Selected Approach**: Design System + WhatsApp Reference Hybrid
- Primary reference: WhatsApp's familiar chat patterns for instant recognition
- Secondary influences: Telegram's bot interaction patterns for AI mode selection
- Foundation: Existing design token system (already implemented in provided code)

**Justification**: Chat applications benefit from familiar patterns that users already understand. The AI transformation layer requires clear visual differentiation, making a systematic approach essential for consistency.

---

## Core Design Principles

1. **Mobile-First Clarity**: Every interaction optimized for thumb-reach and single-handed use
2. **AI Transparency**: Clear visual distinction between user messages, AI interpretations, and system states
3. **Minimal Cognitive Load**: Reduce friction in core messaging flow; complexity hidden in mode selection
4. **Ephemeral Design**: Visual language reinforces temporary nature of conversations

---

## Layout System

**Spacing Primitives**: Use existing token system consistently
- **Chat bubbles**: 12px padding (p-12), 16px horizontal padding for longer messages
- **Message gaps**: 12px vertical spacing between messages (gap-12)
- **Section padding**: 16px (p-16) for header/input areas
- **Mode selector**: 16px padding with 8px internal gaps

**Container Structure**:
- Max-width: 600px centered for desktop viewing
- Full-width on mobile (100vw)
- Fixed header and input area, scrollable message container
- No horizontal scrolling anywhere

---

## Typography Hierarchy

**Message Content**:
- User messages: 14px (base), line-height 1.5, regular weight
- AI responses: 14px (base), line-height 1.5, medium weight (for emphasis)
- Message labels: 11px (xs), uppercase tracking, medium weight
- Timestamps: 11px (xs), secondary color

**Headers & UI**:
- Chat header title: 18px (xl), semibold
- Mode selector heading: 16px (lg), semibold
- System messages: 12px (sm), regular
- Persona badges: 12px (sm), medium weight

---

## Component Library

### 1. **Message Bubbles**

**User Sent Messages**:
- Align right, max-width 85%
- Primary color background
- White/cream text (high contrast)
- Rounded corners (12px), squared bottom-right corner (6px radius)
- No visible sender label (implied "you")

**AI Interpreted Messages**:
- Align left, max-width 90%
- Distinct background (use bg-7 from palette - pink/magenta tint)
- Border: 1px solid card-border
- Label above: "AI Middleman · [Mode Name]"
- Rounded corners (12px), squared bottom-left corner

**Summary Messages**:
- Center-aligned, max-width 95%
- Warning-tinted background (bg-2)
- 2px solid warning color border
- Label: "Conversation Summary"
- Full rounded corners (12px)

**Message Metadata**:
- Timestamp: Bottom-right for sent, bottom-left for received
- 4px margin-top from bubble content
- Secondary text color

### 2. **Mode Selector Interface**

Triggered by `/mode` command, appears as overlay card:

**Container**:
- Semi-modal card overlaying chat (not full-screen)
- Background blur effect behind card
- Card: bg-1 background, rounded-lg (12px), border 1px
- Padding: 16px
- Position: Bottom-anchored, slides up animation

**Radio Options**:
- Vertical list with 8px gaps
- Each option: 8px padding, clickable area
- Radio button: 18px size, primary color when selected
- Option labels: Base font size, left-aligned
- Option descriptions: 12px, secondary color, below label

**Mode Options** (7 total):
1. Whisperer (subtle, nuanced)
2. Chaos Mode (Chinese whisper)
3. Creepy (eerie undertones)
4. Romantic (longing)
5. Flirty (playful charm)
6. Humor (comedic)
7. Neutral (minimal transformation)

**Submit Button**:
- Full-width within card
- Primary button style
- Text: "Switch Mode"
- 12px top margin from options

### 3. **Waiting/Matching Screen**

Before two users connect:

**Layout**:
- Centered flex container
- Vertical stack with 24px gaps
- Padding: 24px

**Elements**:
- Heading: "Finding Your Chat Partner..." (24px, semibold)
- Subtext: "Waiting for another user to connect" (16px, secondary color)
- Animated spinner: 48px diameter, primary color
- Tip text: "Messages will be transformed by AI middleman" (14px, secondary, italic)

### 4. **Input Area**

**Message Input**:
- Textarea with auto-expanding height (44px min, 120px max)
- 12px padding
- Border: 1px solid, focus state with primary color
- Placeholder: "Type your message (min 10 words)..."
- Font: Base size, regular weight

**Send Button**:
- Fixed height: 44px (matches input minimum)
- Padding: 12px horizontal, 20px
- Icon: Send arrow (from icon library)
- Text: "Send" on desktop, icon-only on mobile <480px
- Primary color background

**Cooldown Notice**:
- Below input area, 8px margin-top
- Warning color text, 11px size
- Text: "Please wait Xs before sending next message"
- Centered alignment

**Validation States**:
- Word count indicator: Secondary text, 11px, bottom-left of input
- Shows "X/10 words" until minimum met
- Turns success color when valid

### 5. **Chat Header**

**Left Section**:
- Title: "AI Chat Middleman"
- Subtitle: "Connected" (11px, success color) or "Waiting" (warning color)

**Right Section**:
- Persona badge: Current mode name
- Rounded-full pill style
- Background: bg-5 (purple tint)
- 4px vertical, 12px horizontal padding

**Action Buttons** (icon-only, right-aligned):
- Summarize chat icon (document/list icon)
- Disconnect icon (X or door)
- Both: 32px tap targets, secondary color

### 6. **System Messages**

For events like cooldown, validation, mode changes:

**Container**:
- Center-aligned, full-width
- Background: info background (bg-8)
- Border: 1px solid info color
- Rounded: 8px
- Padding: 8px 12px
- Margin: 8px vertical

**Text**:
- 12px size, info color
- Icon prefix (relevant to message type)
- Examples:
  - "Mode changed to Chaos Mode 🌀"
  - "Cooldown active: 7s remaining ⏱️"
  - "Message too short (5/10 words) ⚠️"

---

## Interaction Patterns

### Message Flow
1. User types in input → Shows word count
2. Meets minimum → Send button becomes active (visual state change)
3. Clicks send → Message appears in chat as "sent" bubble
4. Brief loading indicator (typing dots under AI label)
5. AI response arrives → Slides in with animation
6. Cooldown starts → Input disabled, notice appears

### Mode Selection Flow
1. User types `/mode` in input
2. Input clears, mode selector card slides up from bottom
3. User selects radio option → Highlights visually
4. Clicks submit → Card slides down, confirmation system message appears
5. Next message uses new mode

### Summarize Flow
1. User taps summarize icon in header
2. Loading state: Dimmed overlay, spinner
3. Summary message appears center-aligned in chat
4. Summary stays visible, marked with special styling
5. Next user message includes summary in AI context

---

## Mobile Optimization

**Viewport Considerations**:
- Target: 375px - 428px width (iPhone SE to Pro Max)
- Header: Sticky top, 56px height
- Input area: Sticky bottom, auto-height
- Message container: Calc(100vh - header - input - safe-area-inset)

**Touch Targets**:
- Minimum 44px height for all interactive elements
- 8px minimum spacing between tappable areas
- Mode selector options: Full-width tappable

**Typography Scaling**:
- No font size changes until <360px width
- Then scale down proportionally by 10%

---

## Animations

**Use Sparingly** - Only for state transitions:

1. **Message appearance**: Slide-in from appropriate side (150ms ease-out)
2. **Mode selector**: Slide up/down from bottom (250ms ease-in-out)
3. **Loading states**: Gentle pulse on AI typing indicator
4. **Button interactions**: Subtle scale (0.98) on active press

**No animations for**:
- Scrolling effects
- Background movements
- Decorative transitions

---

## Accessibility

- All interactive elements keyboard navigable
- Focus states: 3px primary color ring
- Screen reader labels for icon-only buttons
- High contrast maintained in both light/dark modes
- Form validation announced to assistive tech
- Cooldown timer announced every 3 seconds

---

## Images

**None required** - This is a utility-focused chat application where text and functional clarity are paramount. Any visual interest comes from the color system and message bubble styling, not imagery.