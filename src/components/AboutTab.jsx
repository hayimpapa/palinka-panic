import { useEffect, useState } from 'react'

const GITHUB_URL = 'https://github.com/hayimpapa/palinka-panic'

const SECTIONS = [
  {
    key: 'problem',
    title: 'The Problem',
    placeholder: 'What problem or itch was this week’s app scratching?',
    default:
      'Week 17 of "52 apps in 52 weeks before I turn 52". I wanted a quick, joyful arcade game with a strong sense of place — something that feels handmade and folksy rather than generic, and that runs entirely in the browser with zero image assets.',
  },
  {
    key: 'approach',
    title: 'The Approach',
    placeholder: 'How did you decide to tackle it?',
    default:
      'A classic "catch the falling things" loop, but every character and object is drawn from scratch with the Canvas 2D API — no sprites, no image files. React + Vite host a full-screen canvas; the game engine is a plain class with an update/draw split. Sound is generated live with the Web Audio API. Visual language: Hungarian embroidery meets cartoon charm.',
  },
  {
    key: 'prompt',
    title: 'The Prompt',
    placeholder: 'The prompt you used to build this.',
    default:
      'See PROMPTS.txt in the repo for the full build prompt. In short: build "Pálinka Panic", a catching game with a Hungarian grandma (Nagymama) at a village market, drawn entirely with Canvas primitives, with difficulty scaling, streak bonuses, a rare golden bottle, and procedural Web Audio sound.',
  },
  {
    key: 'built',
    title: 'What Got Built',
    placeholder: 'What actually shipped?',
    default:
      'A complete playable game: Nagymama with idle-breathing, walk, catch, sad, and triumph animations; standard and golden pálinka bottles with wobble/spin; shatter + liquid-splash particles; confetti and star bursts; folk-art background (village stalls, bunting, hills, cobblestones); difficulty that ramps with time and score; 5-in-a-row double-points streaks; lives, score, high score (localStorage), and a pálinka counter; procedural clink / crash / arpeggio / game-over sounds.',
  },
  {
    key: 'differently',
    title: "What I'd Do Differently",
    placeholder: 'Reflections and next steps.',
    default:
      'Add power-ups (a basket that widens the tray, slow-motion), more bottle varieties, and a proper combo meter. Tune the difficulty curve with playtesting data. Maybe a leaderboard, and richer Nagymama dialogue. The all-canvas art is charming but a vector/asset pipeline would scale the detail further.',
  },
]

function load(key, fallback) {
  try {
    const v = localStorage.getItem('palinkaPanic.about.' + key)
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export default function AboutTab() {
  const [values, setValues] = useState(() => {
    const init = {}
    for (const s of SECTIONS) init[s.key] = load(s.key, s.default)
    return init
  })
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    for (const s of SECTIONS) {
      try {
        localStorage.setItem('palinkaPanic.about.' + s.key, values[s.key])
      } catch {
        /* ignore */
      }
    }
  }, [values])

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 text-stone-100">
      <h2 className="mb-1 font-folk text-3xl font-bold text-amber-300">
        About This Build
      </h2>
      <p className="mb-6 text-sm text-stone-400">
        Pálinka Panic — Week 17 of “52 apps in 52 weeks before I turn 52” by Hey
        I’m Papa. Click any section to edit; changes save to your browser.
      </p>

      <div className="space-y-5">
        {SECTIONS.map((s) => (
          <section
            key={s.key}
            className="rounded-xl border border-stone-700 bg-stone-800/60 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-folk text-xl font-semibold text-red-400">
                {s.title}
              </h3>
              <button
                onClick={() => setEditing(editing === s.key ? null : s.key)}
                className="rounded-md bg-stone-700 px-2 py-1 text-xs text-stone-200 hover:bg-stone-600"
              >
                {editing === s.key ? 'Done' : 'Edit'}
              </button>
            </div>
            {editing === s.key ? (
              <textarea
                autoFocus
                value={values[s.key]}
                placeholder={s.placeholder}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [s.key]: e.target.value }))
                }
                className="h-40 w-full resize-y rounded-md border border-stone-600 bg-stone-900 p-3 text-sm text-stone-100 focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-300">
                {values[s.key] || (
                  <span className="italic text-stone-500">{s.placeholder}</span>
                )}
              </p>
            )}
          </section>
        ))}

        <section className="rounded-xl border border-stone-700 bg-stone-800/60 p-4">
          <h3 className="mb-2 font-folk text-xl font-semibold text-red-400">
            GitHub Link
          </h3>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="break-all text-amber-300 underline hover:text-amber-200"
          >
            {GITHUB_URL}
          </a>
        </section>
      </div>
    </div>
  )
}
