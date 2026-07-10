// Тонкий клиент к Go-бэкенду. В dev запросы к /api проксируются Vite
// на http://localhost:8090 (см. vite.config.ts).
const API_BASE = '/api'

export type Health = {
  status: string
  db: 'ok' | 'unavailable' | 'not_configured'
}

export async function getHealth(): Promise<Health> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
