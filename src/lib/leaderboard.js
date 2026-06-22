// Global leaderboard client for Pálinka Panic.
//
// All score writes go through Supabase Edge Functions, never straight to the
// table: the browser only ever holds the public anon key, and the table's RLS
// policy forbids anon INSERTs. A run is bound to a server-issued, HMAC-signed,
// single-use session token, and the `submit-score` function re-validates that
// the score is even reachable in the time the run actually lasted. Reads are a
// plain public SELECT (the leaderboard is meant to be seen).
//
// If the Supabase env vars are absent (e.g. local dev without a backend) every
// function degrades gracefully and the game falls back to localStorage only.

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const NAME_MAX = 5
const NAME_RE = /[^A-Z0-9]/g

/** Whether a Supabase backend is wired up for this build. */
export function leaderboardEnabled() {
  return Boolean(URL && ANON_KEY)
}

/**
 * Normalise a player-entered initials string: uppercase, ASCII letters/digits
 * only, capped at NAME_MAX characters. Mirrors the server + DB constraints so
 * the UI can never submit something the backend would reject.
 */
export function sanitizeName(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(NAME_RE, '')
    .slice(0, NAME_MAX)
}

function headers() {
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  }
}

async function callFunction(name, body) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body || {}),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `${name} failed (${res.status})`)
  }
  return data
}

/**
 * Open a scored session. Returns an opaque credential to hand back to
 * submitScore(). Resolves to null when the leaderboard is disabled or the
 * backend is unreachable — the game keeps working either way.
 */
export async function startSession() {
  if (!leaderboardEnabled()) return null
  try {
    return await callFunction('start-session', {})
  } catch {
    return null
  }
}

/**
 * Submit a finished run. `session` is the credential from startSession().
 * Returns { ok, rank?, error? }.
 */
export async function submitScore({ session, name, score, caught, elapsed }) {
  if (!leaderboardEnabled()) return { ok: false, error: 'Leaderboard disabled' }
  if (!session) return { ok: false, error: 'No session — score not eligible' }
  const cleaned = sanitizeName(name)
  if (!cleaned) return { ok: false, error: 'Enter 1–5 letters or numbers' }
  try {
    const data = await callFunction('submit-score', {
      sessionId: session.sessionId,
      issuedAt: session.issuedAt,
      token: session.token,
      name: cleaned,
      score,
      caught,
      elapsed,
    })
    return { ok: true, rank: data && data.rank }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/** Fetch the top scores for display. Returns [] on any failure. */
export async function fetchTop(limit = 10) {
  if (!leaderboardEnabled()) return []
  try {
    const res = await fetch(
      `${URL}/rest/v1/high_scores?select=name,score,created_at` +
        `&order=score.desc,created_at.asc&limit=${limit}`,
      { headers: headers() },
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}
