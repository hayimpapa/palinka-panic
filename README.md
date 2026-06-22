# 🍶 Pálinka Panic

A warm, folk-art catching game where you help **Nagymama** (a Hungarian
grandma) catch falling pálinka bottles at a village market before they smash on
the cobblestones. The game speeds up and gets more chaotic the longer you last.

**Week 17** of _"52 apps in 52 weeks before I turn 52"_ by **Hey I'm Papa**.

Every character, bottle, particle, and piece of scenery is drawn from scratch
with the **Canvas 2D API** — there are **no image files** anywhere in the
project. All sound is generated live with the **Web Audio API**.

## How to play

| Platform | Controls |
| --- | --- |
| Desktop | `←` / `→` arrow keys, or `A` / `D` to move Nagymama |
| Mobile  | Touch & drag anywhere, or tap the left / right half of the screen |

The game starts on your first key press or tap.

- Catch a bottle: **+10 points** (and your pálinka counter ticks up)
- Miss a bottle (it smashes): **lose a life** — you start with **3**
- **5 catches in a row** → **double points** for the next 10 catches
- Rare **golden bottle** (10% chance) → **+50 points** and an _"Egészségedre!"_ cheer
- Difficulty ramps: faster falls every 30s, an extra simultaneous bottle every
  50 points (capped at 5), and wobblier bottles past 100 points
- Your best is saved to `localStorage`, and — if a Supabase backend is
  configured — runs can be posted to a **global leaderboard** with 5-character
  initials (`A–Z` / `0–9`, no symbols)

## Global leaderboard (optional)

When the Supabase env vars are set, the game-over screen lets you enter initials
and posts your run to a shared top-10 board. Without them, everything still works
and the board is simply hidden.

Scores can't be faked by hitting the API directly:

- The table has **row-level security with no insert policy**, so the public anon
  key is read-only.
- Writes go through an Edge Function that requires a **signed, single-use session
  token** issued when the run starts, and **re-checks that the score is even
  reachable** in the time the run lasted.
- Database **`CHECK` constraints** enforce the name format and score shape as a
  final backstop.

Setup lives in [`supabase/README.md`](supabase/README.md). Copy `.env.example`
to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Tech stack

- **React + Vite**
- **Canvas 2D API** for all game rendering
- **Web Audio API** for procedural sound
- **Tailwind CSS** for the UI outside the canvas (tabs, About page)

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

Build a production bundle:

```bash
npm run build
npm run preview
```

## Deploy to Vercel

This project is Vercel-ready. `vite.config.js` sets `base: './'` so assets load
from relative paths on any static host.

1. Push the repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Vercel auto-detects Vite. Defaults are correct:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Deploy. That's it.

You can also deploy from the CLI:

```bash
npm i -g vercel
vercel
```

## Project structure

```
index.html
vite.config.js          # base: './' for Vercel/static hosting
src/
  main.jsx              # React entry
  App.jsx               # tabs: Play / About This Build
  index.css             # Tailwind directives
  components/
    GameCanvas.jsx      # canvas element, game loop, input handling
    GameOverPanel.jsx   # game-over overlay: initials entry + leaderboard
    AboutTab.jsx        # editable "About This Build" sections (localStorage)
  game/
    engine.js           # game state machine, physics, difficulty, HUD
    draw.js             # all Canvas 2D drawing (Nagymama, bottles, scene)
    audio.js            # Web Audio sound effects
  lib/
    leaderboard.js      # Supabase leaderboard client (fetch-based)
supabase/
  migrations/           # high_scores table + RLS + constraints
  functions/            # start-session + submit-score Edge Functions
PROMPTS.txt             # the full prompt used to build this
```

## License

MIT — have fun. _Egészségedre!_ 🥃
