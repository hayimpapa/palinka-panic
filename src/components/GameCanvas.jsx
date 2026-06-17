import { useEffect, useRef } from 'react'
import { Game, W, H } from '../game/engine.js'
import { setMuted, isMuted } from '../game/audio.js'

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const game = new Game()
    gameRef.current = game

    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
    }
    resize()

    // ---- main loop ----
    let raf
    let last = performance.now()
    function frame(now) {
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp big gaps (tab switch)
      game.update(dt)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      game.draw(ctx)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // ---- helpers ----
    const toLogical = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * W,
        y: ((clientY - rect.top) / rect.height) * H,
      }
    }

    // ---- keyboard ----
    const pressed = new Set()
    const applyKeys = () => {
      const left = pressed.has('left')
      const right = pressed.has('right')
      game.setMoveDir(left && !right ? -1 : right && !left ? 1 : 0)
    }
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase()
      const isMove = ['arrowleft', 'arrowright', 'a', 'd'].includes(k)
      if (isMove) e.preventDefault()

      if (game.phase !== 'playing') {
        game.start()
        // fall through so the first press also starts moving
      }
      if (k === 'arrowleft' || k === 'a') pressed.add('left')
      if (k === 'arrowright' || k === 'd') pressed.add('right')
      applyKeys()
    }
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') pressed.delete('left')
      if (k === 'arrowright' || k === 'd') pressed.delete('right')
      applyKeys()
    }

    // ---- pointer (touch + mouse) ----
    let dragging = false
    const onPointerDown = (e) => {
      const { x, y } = toLogical(e.clientX, e.clientY)
      if (game.phase === 'start') {
        game.start()
        return
      }
      if (game.phase === 'gameover') {
        const r = game.getPlayAgainRect()
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          game.start()
        }
        return
      }
      dragging = true
      game.setTargetX(x)
      canvas.setPointerCapture?.(e.pointerId)
    }
    const onPointerMove = (e) => {
      if (!dragging || game.phase !== 'playing') return
      const { x } = toLogical(e.clientX, e.clientY)
      game.setTargetX(x)
    }
    const onPointerUp = () => {
      dragging = false
      game.clearTarget()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const toggleMute = () => setMuted(!isMuted())

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <canvas
        ref={canvasRef}
        className="h-full max-h-full w-auto max-w-full rounded-lg shadow-2xl"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      <button
        onClick={toggleMute}
        className="absolute bottom-3 right-3 rounded-full bg-black/30 px-3 py-1 text-sm text-white backdrop-blur hover:bg-black/50"
        aria-label="Toggle sound"
        title="Toggle sound"
      >
        🔊 / 🔇
      </button>
    </div>
  )
}
