// ─────────────────────────────────────────────────────────────────────────────
// Amara — API Client
// All backend calls go through here. Vite proxies /api → localhost:4000
// ─────────────────────────────────────────────────────────────────────────────

// Local: Vite proxies /api → localhost:4000
// Production: set VITE_API_BASE_URL=http://<EC2-IP>/api in .env
const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ── Patients ──────────────────────────────────────────────────────────────────
export const createPatient = (body) => request('POST', '/patients', body)

// ── Chat ──────────────────────────────────────────────────────────────────────
export const sendChatMessage = (body) => request('POST', '/chat/message', body)

