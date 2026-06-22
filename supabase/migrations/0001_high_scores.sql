-- Pálinka Panic — global high-score leaderboard.
--
-- Security model (see supabase/README.md for the full picture):
--   * RLS is ON. The anon/authenticated roles may ONLY read.
--   * There is intentionally NO insert/update/delete policy, so a client
--     holding the public anon key cannot write rows directly through PostgREST.
--   * Writes happen exclusively inside the `submit-score` Edge Function using
--     the service-role key, after it has verified a signed, single-use session
--     token and sanity-checked the score against the run's duration.
--   * The CHECK constraints below are a last line of defence: even a bug in the
--     function (or a leaked service key) cannot persist a malformed row.

create table if not exists public.high_scores (
  id          bigint generated always as identity primary key,
  -- 1–5 chars, uppercase ASCII letters and digits only. No spaces, no symbols.
  name        text        not null check (name ~ '^[A-Z0-9]{1,5}$'),
  -- points are always awarded in multiples of 10; clamp to a sane ceiling.
  score       integer     not null check (score >= 0 and score <= 1000000 and score % 10 = 0),
  caught      integer     not null default 0 check (caught >= 0),
  play_seconds numeric(8,2) not null default 0 check (play_seconds >= 0),
  -- one row per game session; the UNIQUE constraint makes tokens single-use.
  session_id  uuid        not null unique,
  created_at  timestamptz not null default now()
);

-- Leaderboard read pattern: highest score first, earliest achiever wins ties.
create index if not exists high_scores_score_idx
  on public.high_scores (score desc, created_at asc);

alter table public.high_scores enable row level security;

-- Lock down direct table privileges: clients read, nothing more.
revoke all on public.high_scores from anon, authenticated;
grant select on public.high_scores to anon, authenticated;

-- Public, read-only access for the leaderboard view.
drop policy if exists "high_scores public read" on public.high_scores;
create policy "high_scores public read"
  on public.high_scores
  for select
  to anon, authenticated
  using (true);

-- Deliberately NO insert/update/delete policy. The service role (used only by
-- the Edge Function) bypasses RLS; everyone else is read-only.
