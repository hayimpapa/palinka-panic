import {
  drawBackground,
  drawNagymama,
  drawBottle,
  drawHeart,
  drawStar,
  getTray,
  NAGY,
} from './draw.js'
import {
  playCatch,
  playSmash,
  playGolden,
  playGameOver,
  unlockAudio,
} from './audio.js'

export const W = 480
export const H = 800
const GROUND_Y = 700 // smash line
const BASE_Y = H - 36 // Nagymama feet baseline
const HS_KEY = 'palinkaPanic.highScore'

const DEG = Math.PI / 180

export class Game {
  constructor() {
    this.W = W
    this.H = H
    this.highScore = this.loadHighScore()
    this.reset()
    this.phase = 'start' // 'start' | 'playing' | 'gameover'
    this.startBlink = 0
    // optional hooks wired up by the React layer (leaderboard, etc.)
    this.onStart = null
    this.onGameOver = null
  }

  loadHighScore() {
    try {
      return parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0
    } catch {
      return 0
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem(HS_KEY, String(this.highScore))
    } catch {
      /* ignore */
    }
  }

  reset() {
    this.score = 0
    this.lives = 3
    this.caught = 0
    this.elapsed = 0
    this.bottles = []
    this.particles = []
    this.spawnTimer = 0.6
    this.streak = 0
    this.doubleRemaining = 0
    this.nagymama = {
      x: W / 2,
      vx: 0,
      moveDir: 0, // -1, 0, 1 (keyboard)
      targetX: null, // touch target
      walkPhase: 0,
      moving: false,
      breatheT: 0,
    }
    this.fx = {
      trayLiftT: 0,
      catchMoodT: 0,
      sadT: 0,
      redFlashT: 0,
      triumphT: 0,
      speechT: 0,
    }
  }

  // ---- input ----------------------------------------------------------------

  start() {
    if (this.phase === 'playing') return
    unlockAudio()
    this.reset()
    this.phase = 'playing'
    this.onStart?.()
  }

  setMoveDir(dir) {
    this.nagymama.moveDir = dir
    if (dir !== 0) this.nagymama.targetX = null
  }

  setTargetX(x) {
    this.nagymama.targetX = Math.max(0, Math.min(W, x))
    this.nagymama.moveDir = 0
  }

  clearTarget() {
    this.nagymama.targetX = null
  }

  // ---- difficulty -----------------------------------------------------------

  get speedTier() {
    return Math.floor(this.elapsed / 30) // +1 every 30s
  }

  get fallSpeed() {
    return 135 + this.speedTier * 35
  }

  get desiredBottles() {
    return Math.min(5, 1 + Math.floor(this.score / 50)) // +1 per 50 pts, cap 5
  }

  get wobbleAmp() {
    return this.score >= 100 ? 15 * DEG : 5 * DEG // harder spin past 100 pts
  }

  get spawnInterval() {
    return Math.max(0.55, 1.6 - this.speedTier * 0.12)
  }

  // ---- update ---------------------------------------------------------------

  update(dt) {
    this.startBlink += dt
    if (this.phase !== 'playing') {
      // idle breathing keeps animating on start / game-over screens
      this.nagymama.breatheT += dt
      this.updateParticles(dt)
      return
    }

    this.elapsed += dt
    this.updateTimers(dt)
    this.updateNagymama(dt)
    this.updateBottles(dt)
    this.spawn(dt)
    this.updateParticles(dt)
  }

  updateTimers(dt) {
    const f = this.fx
    f.trayLiftT = Math.max(0, f.trayLiftT - dt)
    f.catchMoodT = Math.max(0, f.catchMoodT - dt)
    f.sadT = Math.max(0, f.sadT - dt)
    f.redFlashT = Math.max(0, f.redFlashT - dt)
    f.triumphT = Math.max(0, f.triumphT - dt)
    f.speechT = Math.max(0, f.speechT - dt)
    this.nagymama.breatheT += dt
  }

  updateNagymama(dt) {
    const n = this.nagymama
    const speed = 420
    const half = NAGY.hemW / 2
    let moving = false

    if (n.targetX != null) {
      const diff = n.targetX - n.x
      if (Math.abs(diff) > 4) {
        n.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt)
        moving = true
      }
    } else if (n.moveDir !== 0) {
      n.x += n.moveDir * speed * dt
      moving = true
    }
    n.x = Math.max(half, Math.min(W - half, n.x))
    n.moving = moving
    if (moving) n.walkPhase += dt * 12
  }

  updateBottles(dt) {
    const tray = this.getTrayBox()
    for (const b of this.bottles) {
      b.prevBottom = b.y + 40
      b.y += b.speed * dt
      b.wobbleT += dt
      b.angle = Math.sin(b.wobbleT * b.wobbleSpeed + b.phase) * this.wobbleAmp
      if (b.golden) b.shimmer += dt * 4

      const bottom = b.y + 40

      // catch: bottom crosses the tray surface while horizontally over it
      if (
        !b.dead &&
        b.prevBottom <= tray.y + 14 &&
        bottom >= tray.y &&
        b.x >= tray.x - 6 &&
        b.x <= tray.x + tray.w + 6
      ) {
        this.catchBottle(b)
        continue
      }

      // smash on ground
      if (!b.dead && bottom >= GROUND_Y) {
        this.smashBottle(b)
      }
    }
    this.bottles = this.bottles.filter((b) => !b.dead)
  }

  catchBottle(b) {
    b.dead = true
    let pts = b.golden ? 50 : 10
    if (this.doubleRemaining > 0 && !b.golden) {
      pts *= 2
      this.doubleRemaining--
    }
    this.score += pts
    this.caught++
    this.streak++
    if (this.streak === 5) {
      // reward: double points for the next 10 catches
      this.doubleRemaining = 10
    }

    // tray lift + delight animation
    this.fx.trayLiftT = 0.2
    this.fx.catchMoodT = 0.4

    if (b.golden) {
      this.fx.triumphT = 1.2
      this.fx.speechT = 1.4
      this.spawnConfetti(this.nagymama.x, BASE_Y - 230)
      playGolden()
    } else {
      this.spawnStars(b.x, this.getTrayBox().y)
      playCatch()
    }
  }

  smashBottle(b) {
    b.dead = true
    this.lives--
    this.streak = 0
    this.doubleRemaining = 0
    this.fx.sadT = 1.0
    this.fx.redFlashT = 0.3
    this.spawnShatter(b.x, GROUND_Y, b.golden)
    playSmash()
    if (this.lives <= 0) {
      this.gameOver()
    }
  }

  gameOver() {
    this.phase = 'gameover'
    if (this.score > this.highScore) {
      this.highScore = this.score
      this.saveHighScore()
    }
    playGameOver()
    this.onGameOver?.({
      score: this.score,
      caught: this.caught,
      elapsed: this.elapsed,
    })
  }

  spawn(dt) {
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.bottles.length < this.desiredBottles) {
      this.spawnTimer = this.spawnInterval
      this.spawnBottle()
    } else if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.3
    }
  }

  spawnBottle() {
    const margin = 40
    const golden = Math.random() < 0.1
    this.bottles.push({
      x: margin + Math.random() * (W - margin * 2),
      y: -60,
      speed: this.fallSpeed * (0.9 + Math.random() * 0.25),
      angle: 0,
      wobbleT: Math.random() * 10,
      wobbleSpeed: 2 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      golden,
      shimmer: Math.random() * Math.PI * 2,
      prevBottom: -60,
      dead: false,
    })
  }

  // ---- particles ------------------------------------------------------------

  spawnStars(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      this.particles.push({
        type: 'star',
        x,
        y,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90 - 40,
        life: 0.4,
        max: 0.4,
        rot: a,
      })
    }
  }

  spawnConfetti(x, y) {
    const cols = ['#cd2a2a', '#f5f0e6', '#2e8b3d', '#ffd24a', '#3b7dd8']
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        type: 'confetti',
        x: x + (Math.random() - 0.5) * 40,
        y,
        vx: (Math.random() - 0.5) * 220,
        vy: -120 - Math.random() * 160,
        life: 1.4,
        max: 1.4,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 12,
        w: 6 + Math.random() * 5,
        h: 8 + Math.random() * 6,
        color: cols[i % cols.length],
      })
    }
  }

  spawnShatter(x, y, golden) {
    // glass shards
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + Math.random() * Math.PI
      const sp = 80 + Math.random() * 150
      this.particles.push({
        type: 'shard',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5,
        max: 0.5,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 10,
        size: 5 + Math.random() * 7,
        golden,
      })
    }
    // amber liquid splash
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.8 + Math.random() * Math.PI * 0.6
      const sp = 110 + Math.random() * 120
      this.particles.push({
        type: 'splash',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5,
        max: 0.5,
        size: 4 + Math.random() * 4,
        golden,
      })
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.type !== 'star') p.vy += 520 * dt // gravity
      if (p.vrot) p.rot += p.vrot * dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  // ---- geometry ----
  getTrayBox() {
    const lift = this.fx.trayLiftT > 0 ? 8 : 0
    return getTray(this.nagymama.x, BASE_Y, lift)
  }

  // ---- draw -----------------------------------------------------------------

  draw(ctx) {
    drawBackground(ctx, W, H, GROUND_Y, this.elapsed)

    if (this.phase === 'start') {
      this.drawNagymamaCharacter(ctx, true)
      this.drawParticles(ctx)
      this.drawStartScreen(ctx)
      return
    }

    // bottles
    for (const b of this.bottles) drawBottle(ctx, b)

    this.drawNagymamaCharacter(ctx, false)
    this.drawParticles(ctx)

    // red flash on life lost
    if (this.fx.redFlashT > 0) {
      ctx.fillStyle = `rgba(200,0,0,${0.4 * (this.fx.redFlashT / 0.3)})`
      ctx.fillRect(0, 0, W, H)
    }

    this.drawHUD(ctx)

    if (this.phase === 'gameover') {
      this.drawGameOver(ctx)
    }
  }

  drawNagymamaCharacter(ctx, idleScreen) {
    const n = this.nagymama
    const breathe = Math.sin(n.breatheT * (Math.PI / 1)) // ~2s loop (sin period 2s)
    const f = this.fx
    let mood = 'happy'
    let frontFacing = false
    let armsUp = false

    if (this.phase === 'gameover') {
      mood = 'sad'
      frontFacing = true
    } else if (f.sadT > 0) {
      mood = 'sad'
      frontFacing = true
    } else if (f.triumphT > 0) {
      mood = 'triumph'
      armsUp = true
    } else if (f.catchMoodT > 0) {
      mood = 'catch'
    }

    const trayLift = f.trayLiftT > 0 ? 8 * (f.trayLiftT / 0.2) : 0
    // arms drop briefly when sad (handled by armsUp=false + no tray when very sad)
    drawNagymama(ctx, n.x, BASE_Y, {
      breathe,
      walkPhase: n.walkPhase,
      moving: idleScreen ? false : n.moving,
      trayLift,
      mood,
      armsUp,
      frontFacing,
    })

    // golden-catch speech bubble
    if (f.speechT > 0) {
      this.drawSpeechBubble(ctx, n.x, BASE_Y - 248, 'Egészségedre!')
    }
  }

  drawSpeechBubble(ctx, cx, cy, text) {
    ctx.save()
    ctx.font = 'bold 18px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const w = ctx.measureText(text).width + 28
    const h = 34
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#8B0000'
    ctx.lineWidth = 2.5
    const x = cx - w / 2
    const y = cy - h / 2
    // bubble
    ctx.beginPath()
    ctx.moveTo(x + 12, y)
    ctx.arcTo(x + w, y, x + w, y + h, 12)
    ctx.arcTo(x + w, y + h, x, y + h, 12)
    ctx.arcTo(x, y + h, x, y, 12)
    ctx.arcTo(x, y, x + w, y, 12)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // tail
    ctx.beginPath()
    ctx.moveTo(cx - 8, y + h - 1)
    ctx.lineTo(cx, y + h + 14)
    ctx.lineTo(cx + 8, y + h - 1)
    ctx.closePath()
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.fillStyle = '#8B0000'
    ctx.fillText(text, cx, y + h / 2)
    ctx.restore()
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.max)
      ctx.save()
      ctx.globalAlpha = alpha
      if (p.type === 'star') {
        ctx.fillStyle = '#ffd24a'
        drawStar(ctx, p.x, p.y, 8 * alpha + 2, 3, 5, p.rot)
        ctx.fill()
      } else if (p.type === 'confetti') {
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      } else if (p.type === 'shard') {
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.golden ? 'rgba(255,210,80,0.85)' : 'rgba(200,230,255,0.85)'
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, -p.size)
        ctx.lineTo(p.size * 0.6, p.size * 0.4)
        ctx.lineTo(-p.size * 0.5, p.size * 0.7)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      } else if (p.type === 'splash') {
        ctx.fillStyle = p.golden ? 'rgba(255,200,40,0.9)' : 'rgba(214,142,28,0.9)'
        // teardrop
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, p.size * 0.7, p.size, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  // ---- HUD ----
  drawHUD(ctx) {
    // lives — hearts top left (below the pálinka counter)
    for (let i = 0; i < 3; i++) {
      const filled = i < this.lives
      const x = 28 + i * 30
      const y = 38
      if (filled) {
        drawHeart(ctx, x, y, 22, '#d62828')
      } else {
        ctx.save()
        ctx.globalAlpha = 0.3
        drawHeart(ctx, x, y, 22, '#555')
        ctx.restore()
      }
    }

    // pálinka counter (mini bottle icon + count) top-left, second row
    this.drawMiniBottle(ctx, 24, 70)
    ctx.fillStyle = '#8B0000'
    ctx.font = 'bold 20px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`× ${this.caught}`, 40, 72)

    // score — top centre, large
    ctx.fillStyle = '#8B0000'
    ctx.font = 'bold 40px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(String(this.score), W / 2, 18)

    // double-points indicator
    if (this.doubleRemaining > 0) {
      ctx.fillStyle = '#2e7d32'
      ctx.font = 'bold 15px Georgia, serif'
      ctx.fillText(`2× points (${this.doubleRemaining})`, W / 2, 62)
    } else if (this.streak > 1) {
      ctx.fillStyle = '#b5651d'
      ctx.font = 'bold 14px Georgia, serif'
      ctx.fillText(`streak ${this.streak}`, W / 2, 62)
    }

    // high score — top right
    ctx.fillStyle = '#7a3b00'
    ctx.font = 'bold 16px Georgia, serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('BEST', W - 18, 18)
    ctx.font = 'bold 22px Georgia, serif'
    ctx.fillText(String(this.highScore), W - 18, 36)
  }

  drawMiniBottle(ctx, x, y) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(0.32, 0.32)
    drawBottle(ctx, { x: 0, y: 0, angle: 0, golden: false })
    ctx.restore()
  }

  // ---- start / game over overlays ----
  drawStartScreen(ctx) {
    // soft dim so the title pops
    ctx.fillStyle = 'rgba(255,250,235,0.25)'
    ctx.fillRect(0, 0, W, H)

    const cx = W / 2
    const titleY = 150

    // folk vine border around the title
    this.drawVineBorder(ctx, cx, titleY, 300, 120)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // title
    ctx.fillStyle = '#8B0000'
    ctx.font = 'bold 52px Georgia, serif'
    ctx.fillText('Pálinka', cx, titleY - 24)
    ctx.fillStyle = '#2e7d32'
    ctx.fillText('Panic', cx, titleY + 30)

    // subtitle
    ctx.fillStyle = '#5a3a1a'
    ctx.font = 'italic 18px Georgia, serif'
    ctx.fillText('Catch the bottles before', cx, titleY + 92)
    ctx.fillText('Nagymama cries! 🧓🍶', cx, titleY + 116)

    // prompt (blinking)
    if (Math.floor(this.startBlink * 1.6) % 2 === 0) {
      ctx.fillStyle = '#8B0000'
      ctx.font = 'bold 22px Georgia, serif'
      ctx.fillText('Tap or press any key to start', cx, H - 120)
    }
  }

  drawVineBorder(ctx, cx, cy, w, h) {
    const left = cx - w / 2
    const right = cx + w / 2
    const top = cy - h / 2
    const bottom = cy + h / 2
    ctx.strokeStyle = '#2e7d32'
    ctx.lineWidth = 3
    ctx.strokeRect(left, top, w, h)
    // leaves / berries along the border
    const drawLeaf = (x, y, a) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a)
      ctx.fillStyle = '#3f9d4f'
      ctx.beginPath()
      ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    const drawBerry = (x, y) => {
      ctx.fillStyle = '#cd2a2a'
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
    }
    for (let i = 0; i <= 6; i++) {
      const x = left + (w / 6) * i
      drawLeaf(x, top, (i % 2 === 0 ? 0.5 : -0.5))
      drawLeaf(x, bottom, (i % 2 === 0 ? 0.5 : -0.5) + Math.PI)
      if (i % 2 === 1) {
        drawBerry(x, top)
        drawBerry(x, bottom)
      }
    }
    for (let i = 1; i < 3; i++) {
      const y = top + (h / 3) * i
      drawLeaf(left, y, Math.PI / 2 + 0.4)
      drawLeaf(right, y, -Math.PI / 2 - 0.4)
      drawBerry(left, y)
      drawBerry(right, y)
    }
  }

  drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(20,10,5,0.6)'
    ctx.fillRect(0, 0, W, H)
    const cx = W / 2

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#ffd24a'
    ctx.font = 'bold 60px Georgia, serif'
    ctx.fillText('Ó jaj!', cx, 180)

    ctx.fillStyle = '#fff6e3'
    ctx.font = 'bold 30px Georgia, serif'
    ctx.fillText(`Score: ${this.score}`, cx, 250)
    ctx.font = '22px Georgia, serif'
    ctx.fillText(`Best: ${this.highScore}`, cx, 290)
    ctx.font = 'italic 18px Georgia, serif'
    ctx.fillStyle = '#ffd9b0'
    ctx.fillText(`Pálinka saved: ${this.caught}`, cx, 322)

    // Play Again button (drawn; hit area exposed via getPlayAgainRect)
    const r = this.getPlayAgainRect()
    ctx.fillStyle = '#b3001b'
    this._roundRect(ctx, r.x, r.y, r.w, r.h, 14)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fff6e3'
    this._roundRect(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 10)
    ctx.stroke()
    ctx.fillStyle = '#fff6e3'
    ctx.font = 'bold 24px Georgia, serif'
    ctx.fillText('Play Again', cx, r.y + r.h / 2 + 1)
  }

  getPlayAgainRect() {
    const w = 200
    const h = 58
    return { x: W / 2 - w / 2, y: 520, w, h }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
}
