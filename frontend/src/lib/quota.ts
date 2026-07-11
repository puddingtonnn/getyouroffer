// Freemium counter (v1, per AGENTS.md): 3 free tailor runs, then a stub —
// no real billing. The backend has no quota yet, so the count lives in
// localStorage and is purely informational.
const QUOTA_KEY = 'gyo_free_left'
export const FREE_LIMIT = 3

export function freeLeft(): number {
  const raw = localStorage.getItem(QUOTA_KEY)
  if (raw === null) return FREE_LIMIT
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.min(FREE_LIMIT, n)) : FREE_LIMIT
}

export function consumeFree(): number {
  const left = Math.max(0, freeLeft() - 1)
  localStorage.setItem(QUOTA_KEY, String(left))
  return left
}
