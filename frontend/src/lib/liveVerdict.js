// Verdict rules for Live Call Guard, kept separate from the page so they can be tested.

export const MIN_SPEECH_WINDOWS = 3
export const RECENT = 5
// Real voices captured digitally scored 6–13% in testing; a Veo voice scored 29%, so green stops at 25%.
export const CLEAR_BELOW = 0.25

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null
}
export const pct = (x) => `${Math.round(x * 100)}%`

/*
 * Turns the stream of scored windows into a verdict. The median of the last few speech
 * windows smooths out single odd windows.
 * Through a phone speaker, cloned voices lose most of the traces the model detects (in our
 * tests an ElevenLabs clone fell from 57% to 15%), so in microphone mode a low score proves
 * nothing: it can raise an alert but never report a voice as clean. Calibration only raises
 * the alert bar for microphones that make every voice look synthetic.
 */
export function assess(entries, { mode, baseline, wholeCall = false }) {
  const speech = entries.filter((e) => e.speech)
  const threshold = mode === 'mic' && baseline != null ? Math.min(0.95, Math.max(0.7, baseline + 0.15)) : 0.7
  if (speech.length < MIN_SPEECH_WINDOWS) return { state: 'warming', speechCount: speech.length, threshold }
  const score = median((wholeCall ? speech : speech.slice(-RECENT)).map((e) => e.fake))
  let state
  if (score >= threshold) state = 'alert'
  else if (mode === 'mic') state = 'mic_clear'
  else state = score < CLEAR_BELOW ? 'clear' : 'unsure'
  return { state, score, speechCount: speech.length, threshold, peak: Math.max(...speech.map((e) => e.fake)) }
}

