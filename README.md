# Amara

Live here - https://dwz7lg45qwla4.cloudfront.net/

Amara is an AI front desk assistant for medical practices. Patients chat naturally to book appointments, check prescriptions, and get office info instead of filling out forms or waiting on hold. GPT-4o only decides *which* action to take whether it is booking, cancellation, and lookup runs as deterministic backend code against Postgres.

# Working Screenshots

Patient interacts with Assitant to schedule an appointment with an orthopaedician
<img width="1457" height="638" alt="Screenshot 2026-07-08 at 12 24 12 AM" src="https://github.com/user-attachments/assets/42f76496-c653-4320-94ca-09c6659b9cf3" />

<img width="1468" height="642" alt="Screenshot 2026-07-08 at 12 25 12 AM" src="https://github.com/user-attachments/assets/5115fc68-c330-4482-a0f3-ae8deb6e1859" />




## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Fastify (Node.js) |
| AI | OpenAI GPT-4o (tool-calling) |
| Database | PostgreSQL + Prisma |
| Email | AWS SES + Nodemailer |

## Architecture

```
Browser (React)
      │
      ▼
Fastify API (Node.js)
      │
      ▼
OpenAI GPT-4o ──tool_calls──▶ services/tools.js ──▶ Prisma ──▶ PostgreSQL
```
