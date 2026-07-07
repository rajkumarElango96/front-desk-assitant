# Amara

Live here - https://dwz7lg45qwla4.cloudfront.net/

Amara is an AI front desk assistant for medical practices. Patients chat naturally to book appointments, check prescriptions, and get office info instead of filling out forms or waiting on hold. GPT-4o only decides *which* action to take whether it is booking, cancellation, and lookup runs as deterministic backend code against Postgres.

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
