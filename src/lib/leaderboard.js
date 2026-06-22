// Global leaderboard client for Pálinka Panic.
//
// Talks straight to Supabase with only the public anon key — no Edge Functions,
// no CLI. Writes can't be forged because the table's RLS forbids anon INSERTs;
// scores are recorded only through the SECURITY DEFINER `submit_score` SQL
// function, which validates a server-side session created by `start_game` (see
// supabase/schema.sql). Reads are a plain public SELECT.
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
 * Normalise player-entered initials: uppercase, ASCII letters/digits only,
 * capped at NAME_MAX. Mirrors the SQL constraints so the UI can never submit
 * something the backend would reject.
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

// Call a Postgres function exposed via PostgREST (/rest/v1/rpc/<name>).
async function rpc(name, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args || {}),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* no/!json body */
  }
  if (!res.ok) {
    // PostgREST surfaces RAISE EXCEPTION text in `message`.
    throw new Error((data && (data.message || data.error)) || `${name} failed (${res.status})`)
  }
  return data
}

/**
 * Open a scored session. Returns { sessionId } to hand back to submitScore().
 * Resolves to null when the leaderboard is disabled or the backend is
 * unreachable — the game keeps working either way.
 */
export async function startSession() {
  if (!leaderboardEnabled()) return null
  try {
    const sessionId = await rpc('start_game', {})
    return sessionId ? { sessionId } : null
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
    // submit_score returns the 1-based rank (a scalar).
    const rank = await rpc('submit_score', {
      p_session_id: session.sessionId,
      p_name: cleaned,
      p_score: score,
      p_caught: caught,
      p_elapsed: elapsed,
    })
    return { ok: true, rank: typeof rank === 'number' ? rank : null }
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
