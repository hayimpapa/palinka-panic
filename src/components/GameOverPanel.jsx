import { useEffect, useRef, useState } from 'react'
import {
  leaderboardEnabled,
  sanitizeName,
  submitScore,
  fetchTop,
  NAME_MAX,
} from '../lib/leaderboard.js'

// HTML overlay shown on game over. Handles initials entry (max 5, A–Z/0–9 only)
// and renders the global top-10 leaderboard. Sits on top of the canvas, which
// keeps drawing its folk-art "Ó jaj!" scene underneath.
export default function GameOverPanel({ info, sessionPromise, onPlayAgain }) {
  const enabled = leaderboardEnabled()
  const [name, setName] = useState('')
  const [top, setTop] = useState([])
  const [status, setStatus] = useState('idle') // idle | sending | done | error
  const [message, setMessage] = useState('')
  const [rank, setRank] = useState(null)
  const inputRef = useRef(null)

  // Load the leaderboard whenever a new game-over panel appears.
  useEffect(() => {
    let alive = true
    if (enabled) fetchTop(10).then((rows) => alive && setTop(rows))
    setName('')
    setStatus('idle')
    setMessage('')
    setRank(null)
    inputRef.current?.focus()
    return () => {
      alive = false
    }
  }, [info, enabled])

  const onNameChange = (e) => setName(sanitizeName(e.target.value))

  const submit = async () => {
    if (status === 'sending' || status === 'done') return
    if (!name) {
      setMessage('Enter your initials first')
      return
    }
    setStatus('sending')
    setMessage('')
    const session = sessionPromise ? await sessionPromise : null
    const res = await submitScore({
      session,
      name,
      score: info.score,
      caught: info.caught,
      elapsed: info.elapsed,
    })
    if (res.ok) {
      setStatus('done')
      setRank(res.rank ?? null)
      setMessage(res.rank ? `You're #${res.rank}!` : 'Saved!')
      const rows = await fetchTop(10)
      setTop(rows)
    } else {
      setStatus('error')
      setMessage(res.error || 'Could not save score')
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') submit()
    e.stopPropagation() // don't let game input handlers steal typing
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl border-2 border-amber-200/70 bg-stone-900/95 p-5 text-amber-50 shadow-2xl">
        <h2 className="text-center font-serif text-3xl font-bold text-amber-300">
          Ó jaj!
        </h2>
        <p className="mt-1 text-center font-serif text-lg">
          Score <span className="font-bold text-amber-200">{info.score}</span>
        </p>
        <p className="text-center text-sm text-amber-200/80">
          Pálinka saved: {info.caught}
        </p>

        {enabled && status !== 'done' && (
          <div className="mt-4">
            <label className="mb-1 block text-center text-xs uppercase tracking-wide text-amber-200/80">
              Enter your initials
            </label>
            <div className="flex items-center justify-center gap-2">
              <input
                ref={inputRef}
                value={name}
                onChange={onNameChange}
                onKeyDown={onKeyDown}
                maxLength={NAME_MAX}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ABC"
                className="w-28 rounded-lg border border-amber-300/60 bg-stone-800 px-3 py-2 text-center font-mono text-xl tracking-[0.3em] uppercase text-amber-100 outline-none focus:border-amber-300"
              />
              <button
                onClick={submit}
                disabled={status === 'sending'}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-green-600 disabled:opacity-50"
              >
                {status === 'sending' ? '…' : 'Submit'}
              </button>
            </div>
            <p className="mt-1 text-center text-[11px] text-amber-200/60">
              Up to {NAME_MAX} letters or numbers
            </p>
          </div>
        )}

        {message && (
          <p
            className={
              'mt-3 text-center text-sm font-semibold ' +
              (status === 'error' ? 'text-red-300' : 'text-green-300')
            }
          >
            {message}
          </p>
        )}

        {enabled && (
          <div className="mt-4">
            <h3 className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-amber-200/80">
              Top scores
            </h3>
            {top.length === 0 ? (
              <p className="text-center text-xs text-amber-200/50">
                No scores yet — be the first!
              </p>
            ) : (
              <ol className="space-y-0.5 text-sm">
                {top.map((row, i) => (
                  <li
                    key={i}
                    className={
                      'flex justify-between rounded px-2 py-0.5 ' +
                      (rank === i + 1 ? 'bg-amber-300/20' : '')
                    }
                  >
                    <span className="text-amber-200/70">
                      {i + 1}. <span className="font-mono">{row.name}</span>
                    </span>
                    <span className="font-bold text-amber-100">{row.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        <button
          onClick={onPlayAgain}
          className="mt-5 w-full rounded-xl bg-red-700 py-2.5 font-serif text-lg font-bold text-amber-50 shadow hover:bg-red-600"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
