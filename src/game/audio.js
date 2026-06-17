// All sound generated procedurally with the Web Audio API — no audio files.

let ctx = null
let muted = false

function ac() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  // browsers suspend audio contexts until a user gesture resumes them
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function unlockAudio() {
  ac()
}

export function setMuted(v) {
  muted = v
}

export function isMuted() {
  return muted
}

// short warm "clink" when catching a standard bottle
export function playCatch() {
  const c = ac()
  if (!c || muted) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, t)
  osc.frequency.exponentialRampToValueAtTime(660, t + 0.08)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.1)
}

// low crash: filtered noise burst + descending tone
export function playSmash() {
  const c = ac()
  if (!c || muted) return
  const t = c.currentTime
  const dur = 0.3

  // noise burst
  const bufferSize = Math.floor(c.sampleRate * dur)
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const noise = c.createBufferSource()
  noise.buffer = buffer
  const noiseFilter = c.createBiquadFilter()
  noiseFilter.type = 'lowpass'
  noiseFilter.frequency.setValueAtTime(1800, t)
  noiseFilter.frequency.exponentialRampToValueAtTime(300, t + dur)
  const noiseGain = c.createGain()
  noiseGain.gain.setValueAtTime(0.35, t)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  noise.connect(noiseFilter).connect(noiseGain).connect(c.destination)
  noise.start(t)
  noise.stop(t + dur)

  // descending tone
  const osc = c.createOscillator()
  const og = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, t)
  osc.frequency.exponentialRampToValueAtTime(70, t + dur)
  og.gain.setValueAtTime(0.2, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(og).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur)
}

// ascending C-E-G arpeggio for the golden bottle
export function playGolden() {
  const c = ac()
  if (!c || muted) return
  const notes = [523.25, 659.25, 783.99] // C5 E5 G5
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.15
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(f, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.16)
  })
}

// slow descending tone with a simple feedback-delay "reverb" tail
export function playGameOver() {
  const c = ac()
  if (!c || muted) return
  const t = c.currentTime

  const delay = c.createDelay()
  delay.delayTime.value = 0.18
  const feedback = c.createGain()
  feedback.gain.value = 0.4
  const wet = c.createGain()
  wet.gain.value = 0.5
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(c.destination)

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(330, t)
  osc.frequency.exponentialRampToValueAtTime(60, t + 1.2)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.3)
  osc.connect(gain)
  gain.connect(c.destination)
  gain.connect(delay)
  osc.start(t)
  osc.stop(t + 1.4)
}
