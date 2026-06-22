// POST /functions/v1/start-session
//
// Called when a game run begins. Mints a signed, single-use session token that
// the client must present to `submit-score` when the run ends. The token also
// pins `issuedAt` (server clock), which lets submit-score verify that the score
// is plausible for how long the run actually lasted.

import { preflight, json } from '../_shared/cors.ts'
import { sign } from '../_shared/session.ts'

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const sessionId = crypto.randomUUID()
    const issuedAt = Date.now()
    const token = await sign(sessionId, issuedAt)
    return json({ sessionId, issuedAt, token })
  } catch (err) {
    console.error('start-session error', err)
    return json({ error: 'Could not start session' }, 500)
  }
})
