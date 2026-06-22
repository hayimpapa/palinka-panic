# Supabase backend — global leaderboard

The online high-score board needs just two things, both done from the Supabase
dashboard. No CLI, no Edge Functions.

## 1. Create the table + functions

Open your project → **SQL Editor** → **New query**, paste the entire contents of
[`schema.sql`](schema.sql), and click **Run**. It's safe to re-run.

This creates:

- `high_scores` — the leaderboard table (RLS on, **read-only** for clients).
- `game_sessions` — server-side run tracking (not exposed to clients).
- `start_game()` / `submit_score()` — `SECURITY DEFINER` functions that are the
  only way a score gets written.

## 2. Point the frontend at it

Copy `.env.example` (in the repo root) to `.env` and fill in the two **public**
values from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

That's it. Rebuild/redeploy and the game-over screen will show the board. Without
these vars the game still runs and keeps the best score in `localStorage` only.

> Only ever put the **anon** key in the frontend. The service-role key is never
> needed here — the SQL functions do the privileged work server-side.

## How "no fake scores via the API" works

A static game can't be made truly cheat-proof, but the goal is to stop the easy
attack — POSTing arbitrary scores straight at the API. Defences, outermost first:

1. **No direct writes.** RLS is on with no insert policy, so the anon key can
   only `SELECT high_scores`. `game_sessions` isn't exposed at all.
2. **Server-side sessions.** A run must call `start_game()` first; its timestamp
   comes from the database clock. `submit_score()` rejects anything without a
   valid, unused session, and each session records exactly one score
   (`session_id` is `UNIQUE`).
3. **Plausibility checks.** `submit_score()` rejects runs whose reported duration
   exceeds the real session age, whose score is higher than is reachable in that
   time, or that doesn't line up with the catch count.
4. **CHECK constraints.** The table enforces the name format (`^[A-Z0-9]{1,5}$`)
   and a score that's a non-negative multiple of 10 under a cap — a final
   backstop even against a bug in a function.
