// Signed, single-use game-session tokens.
//
// A token is just an HMAC-SHA256 over "<sessionId>.<issuedAt>" keyed by the
// secret SESSION_SECRET (set with `supabase secrets set`). The client never
// sees the secret, so it cannot forge a session for a score it didn't earn,
// and it cannot tamper with issuedAt to fake the run duration.

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let keyPromise: Promise<CryptoKey> | null = null

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const secret = Deno.env.get('SESSION_SECRET')
    if (!secret) throw new Error('SESSION_SECRET is not configured')
    keyPromise = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  }
  return keyPromise
}

export async function sign(sessionId: string, issuedAt: number): Promise<string> {
  const key = await getKey()
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${sessionId}.${issuedAt}`),
  )
  return base64url(new Uint8Array(sig))
}

// Constant-time string comparison to avoid leaking the signature via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verify(
  sessionId: string,
  issuedAt: number,
  token: string,
): Promise<boolean> {
  if (typeof sessionId !== 'string' || typeof token !== 'string') return false
  if (!Number.isFinite(issuedAt)) return false
  const expected = await sign(sessionId, issuedAt)
  return timingSafeEqual(expected, token)
}
