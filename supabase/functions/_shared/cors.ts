// Shared CORS helpers for the Pálinka Panic Edge Functions.
//
// The game is a static site that may be served from any origin (Vercel,
// localhost, …), so we allow all origins but only the headers/methods we use.
// Tighten `Access-Control-Allow-Origin` to your deployed domain if you prefer.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
