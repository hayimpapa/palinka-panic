// All visuals drawn with Canvas 2D primitives. No image assets.

// ---- shared helpers ---------------------------------------------------------

export function drawStar(ctx, cx, cy, outer, inner, points, rotation = 0) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rotation + (Math.PI * i) / points
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

export function drawHeart(ctx, cx, cy, size, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  const s = size
  ctx.moveTo(cx, cy + s * 0.3)
  ctx.bezierCurveTo(cx, cy, cx - s * 0.5, cy - s * 0.1, cx - s * 0.5, cy - s * 0.35)
  ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.65, cx - s * 0.2, cy - s * 0.7, cx, cy - s * 0.45)
  ctx.bezierCurveTo(cx + s * 0.2, cy - s * 0.7, cx + s * 0.5, cy - s * 0.65, cx + s * 0.5, cy - s * 0.35)
  ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.1, cx, cy, cx, cy + s * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// small filled diamond (cross-stitch motif)
function diamond(ctx, cx, cy, w, h) {
  ctx.beginPath()
  ctx.moveTo(cx, cy - h)
  ctx.lineTo(cx + w, cy)
  ctx.lineTo(cx, cy + h)
  ctx.lineTo(cx - w, cy)
  ctx.closePath()
  ctx.fill()
}

// ---- Nagymama geometry ------------------------------------------------------

// All measurements relative to feet baseline (baseY) and centre x (cx).
export const NAGY = {
  shoeH: 14,
  skirtH: 132,
  hemW: 150,
  waistW: 78,
  torsoH: 48,
  headR: 40,
  trayW: 166,
  trayH: 18,
  trayDepth: 9,
}

// Returns the catch hitbox (tray top surface) in world coords.
export function getTray(cx, baseY, liftPx = 0) {
  const skirtTop = baseY - NAGY.shoeH - NAGY.skirtH
  const shoulderY = skirtTop - NAGY.torsoH
  const trayY = shoulderY + 16 - liftPx
  return {
    x: cx - NAGY.trayW / 2,
    y: trayY,
    w: NAGY.trayW,
    h: NAGY.trayH,
  }
}

// ---- Nagymama -------------------------------------------------------------

// state: { breathe, walkPhase, facing(-1..1 walk dir), trayLift, mood:'happy'|'catch'|'sad'|'triumph',
//          armsUp, frontFacing }
export function drawNagymama(ctx, cx, baseY, state = {}) {
  const {
    breathe = 0,
    walkPhase = 0,
    moving = false,
    trayLift = 0,
    mood = 'happy',
    armsUp = false,
    frontFacing = false,
  } = state

  const skirtBottom = baseY - NAGY.shoeH
  const skirtTop = skirtBottom - NAGY.skirtH
  const shoulderY = skirtTop - NAGY.torsoH
  const headCy = shoulderY - NAGY.headR + 4
  const tray = getTray(cx, baseY, trayLift)

  // vertical breathing scale applied to the whole figure about the feet
  const scaleY = 1 + breathe * 0.02
  ctx.save()
  ctx.translate(cx, baseY)
  ctx.scale(1, scaleY)
  ctx.translate(-cx, -baseY)

  // ---- shoes (with simple walk cycle) ----
  const legSwing = moving ? Math.sin(walkPhase) * 8 : 0
  drawShoe(ctx, cx - 22 + legSwing, skirtBottom)
  drawShoe(ctx, cx + 22 - legSwing, skirtBottom)

  // ---- skirt (A-line navy) ----
  ctx.fillStyle = '#1e2a52'
  ctx.beginPath()
  ctx.moveTo(cx - NAGY.waistW / 2, skirtTop)
  ctx.lineTo(cx + NAGY.waistW / 2, skirtTop)
  ctx.lineTo(cx + NAGY.hemW / 2, skirtBottom)
  ctx.quadraticCurveTo(cx, skirtBottom + 8, cx - NAGY.hemW / 2, skirtBottom)
  ctx.closePath()
  ctx.fill()
  // skirt folds
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 3
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * 22, skirtTop + 14)
    ctx.lineTo(cx + i * 34, skirtBottom)
    ctx.stroke()
  }

  // ---- apron (white with red X-stitch hem) ----
  const apronTop = skirtTop + 6
  const apronW = NAGY.hemW * 0.66
  ctx.fillStyle = '#f7f1e1'
  ctx.beginPath()
  ctx.moveTo(cx - apronW * 0.32, apronTop)
  ctx.lineTo(cx + apronW * 0.32, apronTop)
  ctx.lineTo(cx + apronW / 2, skirtBottom - 6)
  ctx.quadraticCurveTo(cx, skirtBottom + 2, cx - apronW / 2, skirtBottom - 6)
  ctx.closePath()
  ctx.fill()
  // embroidery band
  ctx.fillStyle = '#b3001b'
  const bandY = skirtBottom - 20
  for (let i = -2; i <= 2; i++) {
    diamond(ctx, cx + i * 22, bandY, 6, 9)
  }
  ctx.strokeStyle = '#b3001b'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - apronW * 0.46, bandY + 16)
  ctx.lineTo(cx + apronW * 0.46, bandY + 16)
  ctx.stroke()

  // ---- blouse torso (cream, long sleeves drawn with arms) ----
  ctx.fillStyle = '#fbf6ea'
  roundRect(ctx, cx - NAGY.waistW / 2 - 4, shoulderY, NAGY.waistW + 8, NAGY.torsoH + 10, 16)
  ctx.fill()

  // ---- arms + tray ----
  drawArmsAndTray(ctx, cx, shoulderY, tray, armsUp)

  // ---- head ----
  drawHead(ctx, cx, headCy, NAGY.headR, mood, frontFacing)

  ctx.restore()
  return tray
}

function drawShoe(ctx, x, y) {
  ctx.fillStyle = '#1a1a1a'
  roundRect(ctx, x - 16, y - 6, 32, 14, 7)
  ctx.fill()
}

function drawArmsAndTray(ctx, cx, shoulderY, tray, armsUp) {
  const sleeve = '#fbf6ea'
  const shoulderL = cx - NAGY.waistW / 2 - 2
  const shoulderR = cx + NAGY.waistW / 2 + 2
  const shY = shoulderY + 8

  ctx.strokeStyle = sleeve
  ctx.lineWidth = 18
  ctx.lineCap = 'round'

  if (armsUp) {
    // triumph: arms raised up and out
    ctx.beginPath()
    ctx.moveTo(shoulderL, shY)
    ctx.lineTo(cx - 56, shoulderY - 46)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(shoulderR, shY)
    ctx.lineTo(cx + 56, shoulderY - 46)
    ctx.stroke()
    // hands
    ctx.fillStyle = '#f6c9a3'
    ctx.beginPath(); ctx.arc(cx - 56, shoulderY - 48, 9, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 56, shoulderY - 48, 9, 0, Math.PI * 2); ctx.fill()
  } else {
    // arms reach down-out to the ends of the tray
    ctx.beginPath()
    ctx.moveTo(shoulderL, shY)
    ctx.quadraticCurveTo(tray.x - 6, shY + 8, tray.x + 8, tray.y + 6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(shoulderR, shY)
    ctx.quadraticCurveTo(tray.x + tray.w + 6, shY + 8, tray.x + tray.w - 8, tray.y + 6)
    ctx.stroke()

    // tray: wooden board with darker bottom edge for depth
    ctx.fillStyle = '#6b3e1d'
    roundRect(ctx, tray.x, tray.y + tray.h, tray.w, NAGY.trayDepth, 3)
    ctx.fill()
    ctx.fillStyle = '#a9712f'
    roundRect(ctx, tray.x, tray.y, tray.w, tray.h, 4)
    ctx.fill()
    // wood grain
    ctx.strokeStyle = 'rgba(90,50,20,0.4)'
    ctx.lineWidth = 1.5
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(tray.x + 6, tray.y + (tray.h / 4) * i)
      ctx.lineTo(tray.x + tray.w - 6, tray.y + (tray.h / 4) * i)
      ctx.stroke()
    }
    // hands gripping ends
    ctx.fillStyle = '#f6c9a3'
    ctx.beginPath(); ctx.arc(tray.x + 8, tray.y + 6, 9, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(tray.x + tray.w - 8, tray.y + 6, 9, 0, Math.PI * 2); ctx.fill()
  }
  ctx.lineCap = 'butt'
}

function drawHead(ctx, cx, cy, r, mood, frontFacing) {
  // hair bun on top (layered arcs)
  ctx.fillStyle = '#efe9e4'
  ctx.beginPath(); ctx.arc(cx, cy - r + 4, r * 0.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(cx - 6, cy - r, r * 0.32, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + 8, cy - r + 2, r * 0.28, 0, Math.PI * 2); ctx.fill()

  // face
  ctx.fillStyle = '#f6c9a3'
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()

  // hair frame around face sides
  ctx.fillStyle = '#f4f0ec'
  ctx.beginPath(); ctx.arc(cx - r * 0.78, cy - 6, r * 0.34, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + r * 0.78, cy - 6, r * 0.34, 0, Math.PI * 2); ctx.fill()

  // rosy cheeks
  ctx.fillStyle = 'rgba(232,120,120,0.55)'
  ctx.beginPath(); ctx.arc(cx - r * 0.5, cy + r * 0.18, 8, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + r * 0.5, cy + r * 0.18, 8, 0, Math.PI * 2); ctx.fill()

  const eyeY = cy - 4
  const eyeDx = r * 0.42

  // eyebrows / eyes by mood
  ctx.strokeStyle = '#5a4632'
  ctx.fillStyle = '#3a2c1c'
  ctx.lineWidth = 2.5

  if (mood === 'sad') {
    // frustrated V eyebrows
    ctx.beginPath()
    ctx.moveTo(cx - eyeDx - 8, eyeY - 12)
    ctx.lineTo(cx - eyeDx + 6, eyeY - 6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + eyeDx + 8, eyeY - 12)
    ctx.lineTo(cx + eyeDx - 6, eyeY - 6)
    ctx.stroke()
  }

  // eyes
  ctx.fillStyle = '#3a2c1c'
  ctx.beginPath(); ctx.arc(cx - eyeDx, eyeY, 3.2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + eyeDx, eyeY, 3.2, 0, Math.PI * 2); ctx.fill()

  // laugh lines beside each eye
  ctx.strokeStyle = 'rgba(120,90,60,0.6)'
  ctx.lineWidth = 1.5
  for (const sx of [-1, 1]) {
    const ex = cx + sx * (eyeDx + 8)
    ctx.beginPath(); ctx.arc(ex, eyeY - 3, 5, sx < 0 ? 0.4 : Math.PI - 0.4, sx < 0 ? 1.6 : Math.PI + 1.2); ctx.stroke()
  }

  // mouth by mood
  ctx.strokeStyle = '#7a1f1f'
  ctx.lineWidth = 3
  const mouthY = cy + r * 0.5
  if (mood === 'sad') {
    ctx.beginPath()
    ctx.moveTo(cx - 12, mouthY + 4)
    ctx.quadraticCurveTo(cx, mouthY - 4, cx + 12, mouthY + 4)
    ctx.stroke()
  } else if (mood === 'catch' || mood === 'triumph') {
    // big O of delight
    ctx.fillStyle = '#7a1f1f'
    ctx.beginPath(); ctx.ellipse(cx, mouthY + 2, 8, 10, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.ellipse(cx, mouthY - 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    // warm smile showing top teeth
    ctx.beginPath()
    ctx.moveTo(cx - 13, mouthY - 2)
    ctx.quadraticCurveTo(cx, mouthY + 10, cx + 13, mouthY - 2)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(cx - 9, mouthY - 1)
    ctx.quadraticCurveTo(cx, mouthY + 4, cx + 9, mouthY - 1)
    ctx.closePath()
    ctx.fill()
  }

  // headscarf: triangle over the bun, tied under chin, polka dots
  ctx.fillStyle = '#23306b'
  ctx.beginPath()
  ctx.moveTo(cx - r - 2, cy - 4)
  ctx.quadraticCurveTo(cx, cy - r - 22, cx + r + 2, cy - 4)
  ctx.quadraticCurveTo(cx, cy - r + 6, cx - r - 2, cy - 4)
  ctx.closePath()
  ctx.fill()
  // ties under the chin
  ctx.beginPath()
  ctx.moveTo(cx - 8, cy + r - 6)
  ctx.quadraticCurveTo(cx - 16, cy + r + 10, cx - 4, cy + r + 14)
  ctx.lineTo(cx + 2, cy + r - 2)
  ctx.closePath()
  ctx.fill()
  // polka dots
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  const dots = [
    [-r * 0.45, -r * 0.55],
    [r * 0.2, -r * 0.7],
    [-r * 0.05, -r * 0.35],
    [r * 0.55, -r * 0.3],
    [-r * 0.7, -r * 0.2],
  ]
  for (const [dx, dy] of dots) {
    ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.6, 0, Math.PI * 2); ctx.fill()
  }
}

// ---- Bottles ----------------------------------------------------------------

// bottle: { x, y, angle, golden, shimmer }
export function drawBottle(ctx, b) {
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(b.angle || 0)

  const w = 30
  const h = 78
  const neckW = 12
  const neckH = 18

  // body shape (rounded-shoulder bottle)
  function bodyPath() {
    ctx.beginPath()
    ctx.moveTo(-neckW / 2, -h / 2)
    ctx.lineTo(-neckW / 2, -h / 2 + 4)
    ctx.quadraticCurveTo(-w / 2, -h / 2 + 14, -w / 2, -h / 2 + 30)
    ctx.lineTo(-w / 2, h / 2 - 8)
    ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2 + 8, h / 2)
    ctx.lineTo(w / 2 - 8, h / 2)
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - 8)
    ctx.lineTo(w / 2, -h / 2 + 30)
    ctx.quadraticCurveTo(w / 2, -h / 2 + 14, neckW / 2, -h / 2 + 4)
    ctx.lineTo(neckW / 2, -h / 2)
    ctx.closePath()
  }

  // glass body
  if (b.golden) {
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
    g.addColorStop(0, '#b8860b')
    g.addColorStop(0.4, '#ffe27a')
    g.addColorStop(0.55, '#fff4c2')
    g.addColorStop(0.7, '#ffd24a')
    g.addColorStop(1, '#9c6b08')
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = 'rgba(200,230,255,0.7)'
  }
  bodyPath()
  ctx.fill()

  // amber liquid fill (lower 60%) — clipped to body
  ctx.save()
  bodyPath()
  ctx.clip()
  if (b.golden) {
    ctx.fillStyle = 'rgba(255,200,40,0.6)'
  } else {
    ctx.fillStyle = 'rgba(214,142,28,0.85)'
  }
  ctx.fillRect(-w / 2, h / 2 - h * 0.6, w, h * 0.6)
  ctx.restore()

  // outline
  ctx.strokeStyle = b.golden ? 'rgba(120,80,0,0.7)' : 'rgba(120,150,180,0.7)'
  ctx.lineWidth = 1.5
  bodyPath()
  ctx.stroke()

  // cork
  ctx.fillStyle = '#9a6b3f'
  roundRect(ctx, -neckW / 2 - 1, -h / 2 - neckH, neckW + 2, neckH, 3)
  ctx.fill()
  ctx.fillStyle = '#7d5430'
  ctx.fillRect(-neckW / 2 - 2, -h / 2 - 4, neckW + 4, 4)

  // label
  const lw = 24
  const lh = 26
  ctx.fillStyle = '#fbf3df'
  roundRect(ctx, -lw / 2, -4, lw, lh, 3)
  ctx.fill()
  ctx.strokeStyle = '#caa85f'
  ctx.lineWidth = 1
  roundRect(ctx, -lw / 2, -4, lw, lh, 3)
  ctx.stroke()
  // "PÁLINKA" text
  ctx.fillStyle = '#a4161a'
  ctx.font = 'bold 5px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PÁLINKA', 0, 2)
  // tiny fruit (apricot) with leaf
  ctx.fillStyle = '#f08a24'
  ctx.beginPath(); ctx.arc(0, 13, 4, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#c25e10'
  ctx.lineWidth = 0.7
  ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, 17); ctx.stroke()
  ctx.fillStyle = '#3f9d4f'
  ctx.beginPath(); ctx.ellipse(3, 10, 2.4, 1.3, -0.6, 0, Math.PI * 2); ctx.fill()

  // shine highlight (left side)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-w / 2 + 5, -h / 2 + 18)
  ctx.lineTo(-w / 2 + 5, h / 2 - 14)
  ctx.stroke()

  // golden shimmer: rotating highlight line + sparkles
  if (b.golden) {
    const sh = (b.shimmer || 0)
    ctx.save()
    bodyPath()
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 4
    const off = Math.sin(sh) * w
    ctx.beginPath()
    ctx.moveTo(off - 10, -h / 2)
    ctx.lineTo(off + 6, h / 2)
    ctx.stroke()
    ctx.restore()
  }

  ctx.restore()

  // golden sparkles around the bottle (outside transform so they stay upright)
  if (b.golden) {
    const sparkN = 4
    for (let i = 0; i < sparkN; i++) {
      const a = (b.shimmer || 0) * 1.5 + (i / sparkN) * Math.PI * 2
      const rad = 34 + Math.sin((b.shimmer || 0) * 2 + i) * 4
      const sx = b.x + Math.cos(a) * rad
      const sy = b.y + Math.sin(a) * rad
      ctx.fillStyle = 'rgba(255,240,150,0.95)'
      drawStar(ctx, sx, sy, 4, 1.6, 4, a)
      ctx.fill()
    }
  }
}

// ---- background -------------------------------------------------------------

export function drawBackground(ctx, W, H, groundY, t) {
  // sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, groundY)
  sky.addColorStop(0, '#fff2bf')
  sky.addColorStop(1, '#ffd2a6')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, groundY)

  // rolling green hills
  ctx.fillStyle = '#8fbf6a'
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.quadraticCurveTo(W * 0.2, groundY - 70, W * 0.42, groundY - 30)
  ctx.quadraticCurveTo(W * 0.6, groundY - 80, W * 0.8, groundY - 36)
  ctx.quadraticCurveTo(W * 0.92, groundY - 60, W, groundY - 40)
  ctx.lineTo(W, groundY)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7aad58'
  ctx.beginPath()
  ctx.moveTo(0, groundY)
  ctx.quadraticCurveTo(W * 0.3, groundY - 44, W * 0.55, groundY - 18)
  ctx.quadraticCurveTo(W * 0.78, groundY - 50, W, groundY - 24)
  ctx.lineTo(W, groundY)
  ctx.closePath()
  ctx.fill()

  // market stalls in the far background
  drawStall(ctx, W * 0.12, groundY - 18, 90, 52)
  drawStall(ctx, W * 0.5, groundY - 14, 110, 58)
  drawStall(ctx, W * 0.85, groundY - 18, 86, 50)

  // bunting across the top (Hungarian colours on a curved rope)
  drawBunting(ctx, W)

  // ground: terracotta cobblestone grid
  ctx.fillStyle = '#c2683f'
  ctx.fillRect(0, groundY, W, H - groundY)
  ctx.strokeStyle = 'rgba(120,55,28,0.5)'
  ctx.lineWidth = 2
  const cell = 38
  for (let row = 0; (groundY + row * cell) < H; row++) {
    const y = groundY + row * cell
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    const offset = row % 2 === 0 ? 0 : cell / 2
    for (let x = -offset; x < W; x += cell) {
      ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + cell); ctx.stroke()
    }
  }
  // ground top edge shading
  ctx.fillStyle = 'rgba(90,40,18,0.25)'
  ctx.fillRect(0, groundY, W, 4)
}

function drawStall(ctx, cx, baseY, w, h) {
  // table
  ctx.fillStyle = '#b07a4a'
  ctx.fillRect(cx - w / 2, baseY - h * 0.4, w, h * 0.4)
  ctx.fillStyle = '#8a5c33'
  ctx.fillRect(cx - w / 2, baseY - 4, w, 6)
  // striped triangle roof (red & white)
  const roofH = h * 0.55
  const stripes = 6
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d23b3b' : '#f5f0e6'
    const x0 = cx - w / 2 + (w / stripes) * i
    const x1 = cx - w / 2 + (w / stripes) * (i + 1)
    ctx.beginPath()
    ctx.moveTo(x0, baseY - h)
    ctx.lineTo(x1, baseY - h)
    ctx.lineTo(x1, baseY - h + roofH * (1 - Math.abs((i + 0.5) / stripes - 0.5) * 0.6))
    ctx.lineTo(x0, baseY - h + roofH * (1 - Math.abs((i - 0.5) / stripes - 0.5) * 0.6))
    ctx.closePath()
    ctx.fill()
  }
  // peak
  ctx.fillStyle = '#d23b3b'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - h - 8)
  ctx.lineTo(cx - w / 2, baseY - h + 2)
  ctx.lineTo(cx + w / 2, baseY - h + 2)
  ctx.closePath()
  ctx.fill()
}

function drawBunting(ctx, W) {
  const cols = ['#cd2a2a', '#f5f0e6', '#2e8b3d']
  const count = 14
  const sag = 26
  ctx.strokeStyle = 'rgba(90,60,40,0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 10)
  ctx.quadraticCurveTo(W / 2, 10 + sag, W, 10)
  ctx.stroke()
  for (let i = 0; i < count; i++) {
    const tt = i / (count - 1)
    const x = tt * W
    // point on the quadratic rope
    const y = (1 - tt) * (1 - tt) * 10 + 2 * (1 - tt) * tt * (10 + sag) + tt * tt * 10
    ctx.fillStyle = cols[i % 3]
    ctx.beginPath()
    ctx.moveTo(x - 9, y)
    ctx.lineTo(x + 9, y)
    ctx.lineTo(x, y + 18)
    ctx.closePath()
    ctx.fill()
  }
}
