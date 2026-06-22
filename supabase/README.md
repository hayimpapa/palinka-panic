# Supabase backend — global leaderboard

This folder holds everything for the online high-score board: the table schema
and two Edge Functions. The game works fine without it (localStorage only); set
the env vars to switch the online board on.

```
supabase/
  migrations/0001_high_scores.sql   # table + RLS + CHECK constraints
  functions/
    _shared/cors.ts                 # CORS helpers
    _shared/session.ts              # HMAC signed session tokens
    start-session/index.ts          # mints a signed session at game start
    submit-score/index.ts           # the only write path into high_scores
```

## How "no fake scores via the API" works

A static game can't be made truly cheat-proof, but the goal here is to stop the
easy attack — `POST`ing arbitrary scores straight at the database/API. Defences,
outermost first:

1. **No direct writes.** RLS is on and there is *no* insert policy, so the public
   anon key can only `SELECT`. Writes happen only inside `submit-score`, which
   uses the service-role key server-side.
2. **Signed, single-use sessions.** A run must call `start-session` first, which
   returns an HMAC token (keyed by a secret the browser never sees) over a random
   `sessionId` + server `issuedAt`. `submit-score` rejects anything without a
   valid signature. `session_id` is `UNIQUE`, so each token saves exactly one row.
3. **Plausibility checks.** `submit-score` rejects runs whose reported duration
   exceeds the real wall-clock age of the session, or whose score is higher than
   is reachable in that time, or that doesn't line up with the catch count.
4. **DB constraints.** `CHECK`s enforce the name format (`^[A-Z0-9]{1,5}$`), a
   score that's a non-negative multiple of 10 under a cap — a final backstop even
   against a bug in the function.

## One-time setup

You need the [Supabase CLI](https://supabase.com/docs/guides/cli) and a project.

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# 1. Create the table.
supabase db push

# 2. Set the signing secret used for session tokens (any long random string).
supabase secrets set SESSION_SECRET="$(openssl rand -hex 32)"

# 3. Deploy the functions.
#    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
supabase functions deploy start-session
supabase functions deploy submit-score
```

The functions are called with the anon key as a bearer token (Supabase's default
JWT check is fine — the anon key is a valid project JWT), so no extra config is
needed there.

## Frontend env

Put the public values in `.env` (see `.env.example` in the repo root):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## Local testing

```bash
supabase start
supabase functions serve --env-file ./supabase/.env.local   # SESSION_SECRET=...
```
