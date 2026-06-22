// POST /functions/v1/submit-score
//
// The ONLY write path into public.high_scores. It runs server-side with the
// service-role key (which bypasses RLS), but only after a gauntlet of checks so
// that "just POST a random score to the API" does not work:
//
//   1. Signature   — the session token must be a valid HMAC the client could
//                     not have forged (proves the run came through start-session).
//   2. Freshness   — the session must be neither too young nor too old.
//   3. Single use  — session_id is UNIQUE in the table, so a token buys exactly
//                     one row; replays hit the unique constraint.
//   4. Shape       — name matches ^[A-Z0-9]{1,5}$; score is a non-negative
//                     multiple of 10 under the cap.
//   5. Plausibility— the reported play time cannot exceed the real wall-clock
//                     age of the session, and the score cannot exceed what is
//                     physically reachable in that time (and must line up with
//                     the catch count).
//
// None of this makes a determined cheater impossible (no pure client game can),
// but it stops trivial API spamming of bogus scores.

import { preflight, json } from '../_shared/cors.ts'
import { verify } from '../_shared/session.ts'

const NAME_RE = /^[A-Z0-9]{1,5}$/
const SCORE_CAP = 1_000_000

// Session must be at least this old (a sub-second "run" is bogus) and at most
// this old (stale/replayed tokens are rejected).
const MIN_SESSION_MS = 1_500
const MAX_SESSION_MS = 6 * 60 * 60 * 1000 // 6 hours
const CLOCK_SLACK_S = 10

// Generous upper bound on points reachable in `seconds` of play. Bottles spawn
// no faster than ~1 per 0.5s, up to 5 at once, each worth at most 50 (golden).
// We add headroom so legitimate runs are never rejected.
function maxScoreFor(seconds: number): number {
  return Math.ceil((seconds / 0.5 + 8) * 50)
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const sessionId = body.sessionId
  const issuedAt = Number(body.issuedAt)
  const token = body.token
  const name = typeof body.name === 'string' ? body.name.toUpperCase() : ''
  const score = Number(body.score)
  const caught = Number(body.caught)
  const elapsed = Number(body.elapsed)

  // 4a. Name shape.
  if (!NAME_RE.test(name)) {
    return json({ error: 'Name must be 1–5 letters or numbers' }, 400)
  }

  // 4b. Score shape.
  if (
    !Number.isInteger(score) ||
    score < 0 ||
    score > SCORE_CAP ||
    score % 10 !== 0
  ) {
    return json({ error: 'Invalid score' }, 400)
  }
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return json({ error: 'Invalid run' }, 400)
  }
  const catches = Number.isFinite(caught) && caught >= 0 ? Math.floor(caught) : 0

  // 1. Signature.
  if (typeof sessionId !== 'string' || !(await verify(sessionId, issuedAt, String(token)))) {
    return json({ error: 'Invalid session' }, 401)
  }

  // 2. Freshness.
  const ageMs = Date.now() - issuedAt
  if (ageMs < MIN_SESSION_MS || ageMs > MAX_SESSION_MS) {
    return json({ error: 'Session expired' }, 401)
  }

  // 5. Plausibility.
  const serverSeconds = ageMs / 1000 + CLOCK_SLACK_S
  if (elapsed > serverSeconds) {
    return json({ error: 'Run time exceeds session age' }, 422)
  }
  if (score > maxScoreFor(elapsed)) {
    return json({ error: 'Score not achievable in that time' }, 422)
  }
  // Each catch scores between 10 (normal) and 50 (golden) points.
  if (score < catches * 10 || score > catches * 50) {
    return json({ error: 'Score inconsistent with catches' }, 422)
  }

  // --- Persist via service role (bypasses RLS). ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json({ error: 'Server not configured' }, 500)
  }

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/high_scores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      name,
      score,
      caught: catches,
      play_seconds: Number(elapsed.toFixed(2)),
      session_id: sessionId,
    }),
  })

  if (!insertRes.ok) {
    const text = await insertRes.text()
    // 3. Single use: a replayed token collides on the UNIQUE session_id.
    if (insertRes.status === 409 || text.includes('23505')) {
      return json({ error: 'Score already submitted for this run' }, 409)
    }
    console.error('insert failed', insertRes.status, text)
    return json({ error: 'Could not save score' }, 500)
  }

  // Best-effort rank (1-based): how many scores beat this one, plus one.
  let rank: number | null = null
  try {
    const rankRes = await fetch(
      `${supabaseUrl}/rest/v1/high_scores?select=id&score=gt.${score}`,
      {
        method: 'HEAD',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'count=exact',
        },
      },
    )
    const range = rankRes.headers.get('content-range') // e.g. "*/42"
    const total = range ? parseInt(range.split('/')[1], 10) : NaN
    if (Number.isFinite(total)) rank = total + 1
  } catch {
    /* rank is optional */
  }

  return json({ ok: true, rank })
})
