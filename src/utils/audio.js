/**
 * Minimal Web Audio synthesis for lifeGLANCE.
 * AudioContext is created lazily on the first user gesture (call init()).
 * All play functions are no-ops when muted or before init().
 */

let ctx          = null
let ambientNodes = []
let _muted       = localStorage.getItem('lifeglance-sound') === 'off'

// ── Context ───────────────────────────────────────────────────────────────────

/** Call from a user-gesture handler (click/keydown) to unlock the AudioContext. */
export function init() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch { /* browser doesn't support Web Audio */ }
  } else if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

function getCtx() {
  if (!ctx || ctx.state === 'closed') return null
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// ── Mute ─────────────────────────────────────────────────────────────────────

export function isMuted()     { return _muted }
export function setMuted(val) {
  _muted = !!val
  localStorage.setItem('lifeglance-sound', _muted ? 'off' : 'on')
  if (_muted) _fadeOutAmbient()
}
export function toggleMuted() { setMuted(!_muted); return _muted }

// ── Primitive: single sine/oscillator tone ────────────────────────────────────

function tone(freq, duration, peak = 0.09, type = 'sine', delaySec = 0) {
  if (_muted) return
  const c = getCtx()
  if (!c) return
  const osc  = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.value = freq
  const t0 = c.currentTime + delaySec
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

// ── Typewriter key click ──────────────────────────────────────────────────────
// Short filtered noise burst — muted click of a mechanical key.

export function playKeyClick() {
  if (_muted) return
  const c = getCtx()
  if (!c) return
  const dur    = 0.018
  const bufLen = Math.ceil(c.sampleRate * dur)
  const buf    = c.createBuffer(1, bufLen, c.sampleRate)
  const data   = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3)
  }
  const src  = c.createBufferSource()
  src.buffer = buf
  const filt = c.createBiquadFilter()
  filt.type           = 'bandpass'
  filt.frequency.value = 650 + Math.random() * 250
  filt.Q.value        = 0.9
  const gain = c.createGain()
  gain.gain.value = 0.13
  src.connect(filt)
  filt.connect(gain)
  gain.connect(c.destination)
  src.start()
}

// ── Milestone save chime ──────────────────────────────────────────────────────
// C major triad arpeggio — C5 → E5 → G5 — "this moment is placed".

export function playChime() {
  tone(523.25, 1.1,  0.10, 'sine', 0)
  tone(659.25, 0.95, 0.07, 'sine', 0.07)
  tone(783.99, 0.80, 0.05, 'sine', 0.14)
}

// ── Edit save (single softer note) ───────────────────────────────────────────

export function playEditSave() {
  tone(523.25, 0.7, 0.07, 'sine', 0)
}

// ── Navigation tick ───────────────────────────────────────────────────────────
// Lower pitch = moving into the past; higher = moving into the future.

export function playNavTick(goingForward = false) {
  tone(goingForward ? 587.33 : 369.99, 0.13, 0.045, 'sine', 0)
}

// ── Onboarding ambient drone ──────────────────────────────────────────────────
// A2 (110 Hz) drone + slight detune copy + E3 fifth, each with a slow LFO
// for a subtle breathing quality.

export function startAmbient() {
  if (_muted || ambientNodes.length) return
  const c = getCtx()
  if (!c) return

  const voices = [
    { freq: 110.0,  peakGain: 0.035, lfoFreq: 0.17 },
    { freq: 110.4,  peakGain: 0.025, lfoFreq: 0.23 },
    { freq: 164.81, peakGain: 0.018, lfoFreq: 0.13 },
  ]

  voices.forEach(({ freq, peakGain, lfoFreq }) => {
    const osc    = c.createOscillator()
    const gainNd = c.createGain()
    const lfo    = c.createOscillator()
    const lfoGn  = c.createGain()

    osc.type = 'sine'
    osc.frequency.value = freq

    lfo.type = 'sine'
    lfo.frequency.value = lfoFreq
    lfoGn.gain.value = peakGain * 0.3   // LFO depth = 30 % of base gain

    lfo.connect(lfoGn)
    lfoGn.connect(gainNd.gain)
    osc.connect(gainNd)
    gainNd.connect(c.destination)

    gainNd.gain.setValueAtTime(0, c.currentTime)
    gainNd.gain.linearRampToValueAtTime(peakGain, c.currentTime + 2.5)

    osc.start()
    lfo.start()

    ambientNodes.push({ osc, gainNd, lfo })
  })
}

function _fadeOutAmbient() {
  const c = ctx   // use raw ctx — getCtx() might be null if closed
  const nodes = ambientNodes
  ambientNodes = []
  nodes.forEach(({ osc, gainNd, lfo }) => {
    if (c && c.state !== 'closed') {
      gainNd.gain.cancelScheduledValues(c.currentTime)
      gainNd.gain.setValueAtTime(gainNd.gain.value, c.currentTime)
      gainNd.gain.linearRampToValueAtTime(0, c.currentTime + 1.2)
    }
    try { osc.stop(c ? c.currentTime + 1.3 : 0) } catch {}
    try { lfo.stop(c ? c.currentTime + 1.3 : 0) } catch {}
  })
}

export function stopAmbient() { _fadeOutAmbient() }
