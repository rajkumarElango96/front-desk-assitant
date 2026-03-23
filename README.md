# AI Front Desk Assistant

A conversational AI front desk for medical practices. Patients chat with **Kara**, an AI assistant that books appointments, retrieves provider availability, and surfaces prescription info — all through natural language.

Built as a full-stack demonstration of AI tool routing via the **Model Context Protocol (MCP)**.

---

## What It Does

- Patient checks in via an intake form (name, DOB, contact details)
- Kara greets the patient and understands natural language requests
- Patient can ask to book an appointment, check prescriptions, or get office info
- Kara surfaces available slots as interactive UI cards — patient selects a slot
- Booking is confirmed and a **confirmation email is sent automatically via AWS SES**
- All AI tool calls are routed through an MCP server — the AI never touches the database directly

---

## Architecture

```
Browser (React)
     │
     │  HTTPS
     ▼
  Nginx (port 80)
     │
     ├── /          →  React static build (dist/)
     └── /api/*     →  Fastify API (port 4000)
                              │
                    ┌─────────┴──────────┐
                    │                    │
               OpenAI GPT-4o       MCP Server
               (tool-calling)    (child process)
                                       │
                                  Prisma ORM
                                       │
                                  PostgreSQL
```

---

## Why MCP?

The AI layer is decoupled from the database via the **Model Context Protocol** — a JSON-RPC 2.0 standard for AI tool routing.

Instead of importing database functions directly into the OpenAI service, the backend spawns an MCP server as a child process. GPT-4o discovers and calls tools through the protocol. This means:

- The database layer is fully swappable without touching the AI layer
- Tools can be tested independently of the LLM
- The architecture scales to multiple AI clients sharing one tool server

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast builds, component-driven chat UI |
| Backend | Fastify + Node.js | Fast, schema-validated, production-ready |
| AI | OpenAI GPT-4o | Tool-calling loop for natural language → action |
| Tool routing | MCP (hand-rolled + official SDK) | Decoupled, swappable, protocol-standard |
| Database | PostgreSQL + Prisma | Relational data, type-safe queries, easy migrations |
| Email | AWS SES + Nodemailer | Production-grade transactional email |
| Hosting | AWS EC2 + Nginx + PM2 | Always-on, reverse proxied, process-managed |

---

## MCP Tools

| Tool | What it does |
|---|---|
| `find_available_slots` | Returns available slots filtered by specialty and date range |
| `book_appointment` | Creates the appointment, marks slot as booked, fires confirmation email |
| `get_patient_appointments` | Returns all upcoming appointments for the patient |
| `get_patient_prescriptions` | Returns all prescriptions linked to the patient |
| `cancel_appointment` | Cancels appointment and releases the slot back to available |

---

## Local Setup

### Backend
```bash
cd back-end
npm install
cp .env.example .env   # fill in your keys
npx prisma migrate dev
npx prisma db seed
npm run dev            # starts on port 4000
```

### Frontend
```bash
cd front-end
npm install
npm run dev            # starts on port 5173
```

### Environment Variables
```env
DATABASE_URL=postgresql://user:password@localhost:5432/front_desk
OPENAI_API_KEY=sk-...
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_USER=your_ses_smtp_user
SMTP_PASS=your_ses_smtp_pass
SMTP_FROM="Front Desk AI <noreply@yourdomain.com>"
PORT=4000
```

---

## Project Structure

```
├── front-end/
│   └── src/
│       ├── components/
│       │   ├── chat/         # ChatScreen, MessageBubble, TypingIndicator
│       │   ├── intake/       # Patient intake form
│       │   └── shared/       # SlotPicker, ConfirmationCard, PrescriptionCards
│       └── api/              # Centralised API client
│
└── back-end/
    └── src/
        ├── mcp/              # MCP server (official SDK, stdio transport)
        ├── services/         # MCP client, OpenAI tool-calling loop
        ├── routes/           # Fastify route handlers
        ├── plugins/          # Prisma plugin
        └── utils/            # Mailer (AWS SES)
```
