-- ============================================================================
-- Pálinka Panic — global high-score leaderboard
-- ----------------------------------------------------------------------------
-- Paste this whole file into the Supabase SQL Editor (Dashboard → SQL Editor →
-- New query → Run). No CLI, no Edge Functions required. It is safe to re-run.
--
-- Security model — why "just POST a random score at the API" doesn't work:
--   * Row-Level Security is ON and there is NO insert policy, so the public
--     anon key can only READ the table, never write to it.
--   * Writes happen only inside the SECURITY DEFINER function submit_score(),
--     which runs as the table owner (bypassing RLS) AFTER it validates input.
--   * A run must first call start_game(), which creates a server-side session
--     row (its timestamp comes from the database clock, not the browser).
--     submit_score() then checks that:
--        - the session exists and hasn't been used (each session = one score),
--        - enough real time has actually elapsed for the run,
--        - the score is even reachable in that time, and lines up with catches,
--        - the name is 1–5 chars of A–Z / 0–9 only.
--   * CHECK constraints on the table are a final backstop.
-- No pure-client game is 100% cheat-proof, but this stops trivial API spamming.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.high_scores (
  id           bigint generated always as identity primary key,
  -- 1–5 chars, uppercase ASCII letters and digits only. No spaces, no symbols.
  name         text         not null check (name ~ '^[A-Z0-9]{1,5}$'),
  -- points are always awarded in multiples of 10; clamp to a sane ceiling.
  score        integer      not null check (score >= 0 and score <= 1000000 and score % 10 = 0),
  caught       integer      not null default 0 check (caught >= 0),
  play_seconds numeric(8,2) not null default 0 check (play_seconds >= 0),
  -- one row per game session; UNIQUE makes each session single-use.
  session_id   uuid         not null unique,
  created_at   timestamptz  not null default now()
);

-- Leaderboard read pattern: highest score first, earliest achiever wins ties.
create index if not exists high_scores_score_idx
  on public.high_scores (score desc, created_at asc);

-- Server-side game sessions. Created by start_game(), consumed by submit_score().
create table if not exists public.game_sessions (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  used       boolean     not null default false
);

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------

alter table public.high_scores  enable row level security;
alter table public.game_sessions enable row level security;

-- high_scores: clients may read, nothing more. (No insert/update/delete policy.)
revoke all on public.high_scores from anon, authenticated;
grant select on public.high_scores to anon, authenticated;

drop policy if exists "high_scores public read" on public.high_scores;
create policy "high_scores public read"
  on public.high_scores
  for select
  to anon, authenticated
  using (true);

-- game_sessions: never touched directly by clients — only via the functions
-- below. RLS is on with no policies, so anon/authenticated get nothing.
revoke all on public.game_sessions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Functions (SECURITY DEFINER — run as the owner, which bypasses RLS)
-- ----------------------------------------------------------------------------

-- Begin a run. Returns a session id the client must hand back to submit_score().
create or replace function public.start_game()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  insert into public.game_sessions default values returning id into sid;
  return sid;
end;
$$;

-- Finish a run and (if valid) record the score. Returns the 1-based rank.
create or replace function public.submit_score(
  p_session_id uuid,
  p_name       text,
  p_score      integer,
  p_caught     integer,
  p_elapsed    numeric
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  sess        public.game_sessions%rowtype;
  clean_name  text;
  age_seconds numeric;
  max_score   integer;
  catches     integer;
  out_rank    bigint;
begin
  -- Name: uppercase, must be 1–5 chars of A–Z / 0–9.
  clean_name := upper(coalesce(p_name, ''));
  if clean_name !~ '^[A-Z0-9]{1,5}$' then
    raise exception 'Name must be 1-5 letters or numbers';
  end if;

  -- Score shape: non-negative multiple of 10 under the cap.
  if p_score is null or p_score < 0 or p_score > 1000000 or (p_score % 10) <> 0 then
    raise exception 'Invalid score';
  end if;

  if p_elapsed is null or p_elapsed < 0 then
    raise exception 'Invalid run';
  end if;

  catches := greatest(coalesce(p_caught, 0), 0);

  -- Look up and lock the session so it can't be consumed twice concurrently.
  select * into sess from public.game_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Invalid session';
  end if;
  if sess.used then
    raise exception 'Score already submitted for this run';
  end if;

  age_seconds := extract(epoch from (now() - sess.created_at));

  -- Freshness: a real run lasts a few seconds; reject sub-second and stale ones.
  if age_seconds < 1.5 or age_seconds > 21600 then  -- 6 hours
    raise exception 'Session expired';
  end if;

  -- Reported run time can't exceed the real session age (+10s clock slack).
  if p_elapsed > age_seconds + 10 then
    raise exception 'Run time exceeds session age';
  end if;

  -- Generous upper bound: bottles spawn no faster than ~1/0.5s, up to 5 at once,
  -- each worth at most 50 (golden). Headroom so legit runs are never rejected.
  max_score := ceil((p_elapsed / 0.5 + 8) * 50);
  if p_score > max_score then
    raise exception 'Score not achievable in that time';
  end if;

  -- Each catch scores between 10 (normal) and 50 (golden) points.
  if p_score < catches * 10 or p_score > catches * 50 then
    raise exception 'Score inconsistent with catches';
  end if;

  -- Consume the session and record the score.
  update public.game_sessions set used = true where id = p_session_id;

  insert into public.high_scores (name, score, caught, play_seconds, session_id)
  values (clean_name, p_score, catches, round(p_elapsed, 2), p_session_id);

  select count(*) + 1 into out_rank from public.high_scores where score > p_score;
  return out_rank;
end;
$$;

-- Expose the functions to the public API; lock out everything else.
revoke all on function public.start_game() from public;
revoke all on function public.submit_score(uuid, text, integer, integer, numeric) from public;
grant execute on function public.start_game() to anon, authenticated;
grant execute on function public.submit_score(uuid, text, integer, integer, numeric) to anon, authenticated;
