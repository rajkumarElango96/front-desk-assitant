# Amara — Frontend

React patient-facing chat interface for the Amara AI assistant.

## Stack

- **React 18** + **Vite**
- Minimal flat UI — solid blue background, white/blue-tinted chat bubbles
- No UI framework — all styling is inline + a small custom CSS file

## Key Components

```
App.jsx
  ├── IntakeCard       — patient registration form (new vs. returning patient)
  └── ChatScreen       — full-page chat interface
        ├── MessageBubble  — renders text bubbles + slot cards
        ├── SlotPicker     — 2-col grid of appointment slot cards
        └── TypingIndicator
```

## Chat Flow

1. Patient fills out intake form → `POST /api/patients` → receives `patientId`
2. Patient sends a message → `POST /api/chat/message` with full `conversationHistory`
3. Backend returns `reply` (text) + optional `slotsData` (structured slot objects)
4. If `slotsData` present → render `SlotPicker` cards grouped by provider
5. Patient taps a slot → auto-sends booking message to Amara

## Local Setup

```bash
npm install
npm run dev    # starts on http://localhost:3000
```

Vite proxies `/api/*` → `http://127.0.0.1:4000` (backend must be running).

## Environment

No `.env` needed for the frontend — all API calls go through the Vite proxy to the backend.

## What's Complete

- Patient intake (new + returning patient flows) with live validation
- Full-page AI chat with typing indicator and auto-scroll
- Slot cards rendered inline in chat from real API data
- Action buttons (Schedule, Prescriptions, Appointments, Office Info)

## What's Incomplete

- **SMS opt-in**: Checkbox is present but backend SMS sending not implemented
- **Mobile responsiveness**: Designed for desktop — not optimised for small screens
