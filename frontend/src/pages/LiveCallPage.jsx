import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AudioLines, CheckCircle2, FileAudio, Laptop, Loader2, Mic, PhoneCall, ShieldAlert, ShieldCheck, ShieldQuestion, Square,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { startCapture, scoreWindow } from '@/lib/liveAudio'
import { assess, median, pct } from '@/lib/liveVerdict'
import { cn } from '@/lib/utils'

const SOURCES = [
  {
    key: 'system',
    icon: Laptop,
    title: 'Call on this computer',
    badge: 'Most accurate',
    text: 'Meet, Zoom, Teams or WhatsApp Desktop. Listens to the call’s audio directly; choose the call’s tab or your screen and turn on “Share audio”.',
  },
  {
    key: 'mic',
    icon: Mic,
    title: 'Phone on speaker',
    badge: 'Experimental',
    badgeTone: 'inconclusive',
    text: 'Uses the microphone. Phone speakers remove most of the traces cloned voices leave, so this mode can only warn, never confirm a voice is real.',
  },
  {
    key: 'file',
    icon: FileAudio,
    title: 'Play a recording',
    text: 'Streams a voice note or recording through the live check as it plays. Useful for demos.',
  },
]

const CALIBRATION_SECONDS = 10
const STATES = {
  warming: { icon: Loader2, title: 'Listening for speech…', text: 'A verdict appears after a few seconds of talking.', tone: 'muted', spin: true },
  clear: { icon: ShieldCheck, title: 'No signs of a cloned voice', text: 'Nothing synthetic heard so far. Detectors can miss new voice generators, so if the request is unusual, verify another way.', tone: 'authentic' },
  mic_clear: { icon: ShieldQuestion, title: 'No clear warning signs', text: 'Phone speakers hide most traces of cloned voices, so this can’t confirm the caller is real. If they ask for money or codes, hang up and call back on a number you already have.', tone: 'muted' },
  unsure: { icon: ShieldQuestion, title: 'Not sure yet', text: 'Some parts sound unusual. Ask a question only the real person would know.', tone: 'inconclusive' },
  alert: { icon: ShieldAlert, title: 'This voice may be cloned', text: 'Don’t send money, codes or details. Ask your safe-word question, or hang up and call back on a number you already have.', tone: 'manipulated' },
}
const TONE_TEXT = { muted: 'text-muted-foreground', authentic: 'text-authentic', inconclusive: 'text-inconclusive', manipulated: 'text-manipulated' }
const TONE_BG = { muted: 'bg-muted', authentic: 'bg-authentic', inconclusive: 'bg-inconclusive', manipulated: 'bg-manipulated' }
const barTone = (f) => (f < 0.4 ? 'authentic' : f < 0.7 ? 'inconclusive' : 'manipulated')

function SourcePicker({ source, setSource, file, setFile, disabled }) {
  return (
    <div className="grid gap-3">
      {SOURCES.map((s) => (
        <label
          key={s.key}
          className={cn(
            'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
            source === s.key ? 'border-foreground/40 bg-accent' : 'hover:border-foreground/20',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          <input type="radio" name="source" value={s.key} checked={source === s.key} onChange={() => setSource(s.key)} className="sr-only" />
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', source === s.key ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
            <s.icon className="size-5" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="flex flex-wrap items-center gap-2 font-medium">
              {s.title}
              {s.badge && (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', s.badgeTone === 'inconclusive' ? 'bg-inconclusive/15 text-inconclusive' : 'bg-authentic/15 text-authentic')}>
                  {s.badge}
                </span>
              )}
            </span>
            <span className="block text-sm text-muted-foreground">{s.text}</span>
            {s.key === 'file' && source === 'file' && (
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-xs file:text-foreground"
              />
            )}
            {s.key === 'file' && file && source === 'file' && <span className="block truncate text-xs">{file.name}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}

function LevelMeter({ level }) {
  // Speech in a call sits around 0.02–0.2 RMS; map it onto a 0–100% bar on a log-ish scale.
  const width = Math.min(100, Math.max(0, ((Math.log10(level + 1e-4) + 3) / 2.3) * 100))
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-label="Input level">
      <div className="h-full rounded-full bg-signal transition-[width] duration-100" style={{ width: `${width}%` }} />
    </div>
  )
}

function Timeline({ entries }) {
  const shown = entries.slice(-60)
  return (
    <div className="flex h-24 items-end gap-[3px]" aria-label="Score for each two-second window">
      {shown.map((e) => (
        <div
          key={e.t}
          title={e.speech ? `${e.t}s: ${pct(e.fake)} synthetic` : `${e.t}s: no speech`}
          className={cn('min-w-[4px] flex-1 rounded-sm', e.speech ? TONE_BG[barTone(e.fake)] : 'bg-muted')}
          style={{ height: e.speech ? `${Math.max(8, e.fake * 100)}%` : '6%', opacity: e.speech ? 0.85 : 1 }}
        />
      ))}
      {Array.from({ length: Math.max(0, 30 - shown.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="min-w-[4px] flex-1 rounded-sm bg-muted/40" style={{ height: '6%' }} />
      ))}
    </div>
  )
}

export default function LiveCallPage() {
  const [source, setSource] = useState('system')
  const [file, setFile] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | calibrating | listening | done
  const [entries, setEntries] = useState([])
  const [level, setLevel] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [baseline, setBaseline] = useState(null)
  const [calibration, setCalibration] = useState([])
  const [error, setError] = useState(null)
  const [alertedAt, setAlertedAt] = useState(null) // seconds into the call when it was first flagged

  const capture = useRef(null)
  const startedAt = useRef(0)
  const busy = useRef(false)
  const pending = useRef(null)
  const phaseRef = useRef('idle')
  phaseRef.current = phase

  const stopCapture = useCallback(() => {
    capture.current?.stop()
    capture.current = null
    setLevel(0)
  }, [])

  useEffect(() => () => capture.current?.stop(), [])

  useEffect(() => {
    if (phase !== 'listening' && phase !== 'calibrating') return undefined
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 500)
    return () => clearInterval(id)
  }, [phase])

  // Scores windows one at a time; if the server is busy, only the newest waiting window is kept.
  const handleWindow = useCallback(async (pcm, mode) => {
    if (busy.current) {
      pending.current = { pcm, mode }
      return
    }
    busy.current = true
    try {
      const t = Math.round((Date.now() - startedAt.current) / 1000)
      const r = await scoreWindow(pcm)
      const entry = { t, speech: r.speech, fake: r.fake }
      if (mode === 'calibrate') setCalibration((c) => [...c, entry])
      // Windows still in flight when the audio ends are kept, so short recordings get a verdict.
      else if (phaseRef.current !== 'idle') setEntries((list) => [...list, entry])
    } catch (err) {
      setError(err.message)
    } finally {
      busy.current = false
      const next = pending.current
      pending.current = null
      if (next) handleWindow(next.pcm, next.mode)
    }
  }, [])

  async function begin(mode) {
    setError(null)
    if (mode === 'listen' && source === 'file' && !file) {
      setError('Choose a recording to play first.')
      return
    }
    try {
      startedAt.current = Date.now()
      setElapsed(0)
      if (mode === 'listen') {
        setEntries([])
        setAlertedAt(null)
      }
      else setCalibration([])
      capture.current = await startCapture({
        source: mode === 'calibrate' ? 'mic' : source,
        file,
        onWindow: (pcm) => handleWindow(pcm, mode),
        onLevel: setLevel,
        onEnd: () => finish(),
      })
      setPhase(mode === 'calibrate' ? 'calibrating' : 'listening')
    } catch (err) {
      stopCapture()
      setError(err.name === 'NotAllowedError' ? 'Permission was denied. Allow access in the browser prompt and try again.' : err.message)
    }
  }

  function finish() {
    stopCapture()
    setPhase((p) => (p === 'calibrating' ? 'idle' : p === 'listening' ? 'done' : p))
  }

  // Calibration: about 10 s of the user's own voice on this microphone.
  useEffect(() => {
    if (phase !== 'calibrating' || elapsed < CALIBRATION_SECONDS + 1) return
    const speech = calibration.filter((c) => c.speech).map((c) => c.fake)
    setBaseline(speech.length ? median(speech) : null)
    if (!speech.length) setError('No speech was heard. Speak normally, close to the phone’s position, and try again.')
    finish()
  }, [phase, elapsed, calibration]) // eslint-disable-line react-hooks/exhaustive-deps

  const done = phase === 'done'
  const raw = assess(entries, { mode: source, baseline, wholeCall: done })
  // Remember the first alert: a warning shouldn't vanish because a few seconds sound more natural.
  useEffect(() => {
    if (phase === 'listening' && raw.state === 'alert' && alertedAt == null) setAlertedAt(elapsed)
  }, [phase, raw.state, alertedAt, elapsed])
  const stickyAlert = alertedAt != null && (done || (raw.score ?? 0) >= raw.threshold - 0.1)
  const verdict = stickyAlert ? { ...raw, state: 'alert' } : raw
  const unreliableMic = source === 'mic' && baseline != null && baseline >= 0.6
  // After the session, a missing verdict shouldn't keep spinning.
  const st = phase === 'done' && verdict.state === 'warming' ? { ...STATES.warming, icon: ShieldQuestion, spin: false } : STATES[verdict.state]
  const live = phase === 'listening'

  return (
    <div className="space-y-6">
      <section className="floating-panel relative overflow-hidden rounded-3xl bg-card p-6 text-foreground sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 animate-float place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <PhoneCall className="size-7" />
            </span>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                Live Call Guard
                <span className="inline-flex items-center gap-1.5 rounded-full bg-manipulated/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-manipulated uppercase">
                  <span className={cn('size-1.5 rounded-full bg-manipulated', live && 'animate-pulse')} />
                  {live ? 'Live' : 'Ready'}
                </span>
              </h1>
              <p className="text-muted-foreground">Listens to a call as it happens and warns you if the voice sounds cloned.</p>
            </div>
          </div>
          {live && (
            <button type="button" onClick={finish} className="inline-flex items-center gap-2 self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 sm:self-auto">
              <Square className="size-4" /> Stop listening
            </button>
          )}
        </div>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(phase === 'idle' || phase === 'calibrating') && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">What should it listen to?</h2>
            <SourcePicker source={source} setSource={setSource} file={file} setFile={setFile} disabled={phase === 'calibrating'} />

            {source === 'mic' && (
              <div className="space-y-2 rounded-xl bg-muted/60 p-4 text-sm">
                <p className="rounded-lg border border-inconclusive/40 bg-inconclusive/10 p-3 text-xs text-foreground">
                  <span className="font-semibold">Why this mode can only warn:</span> a phone speaker strips out most of what makes a
                  cloned voice detectable. In our tests an ElevenLabs clone scored 57% when captured directly but only 15% through a
                  speaker and microphone. For a call on your phone, record it and use “Play a recording”, or take the call on
                  WhatsApp Desktop and use “Call on this computer”.
                </p>
                <p className="font-medium">Calibrate (recommended)</p>
                <p className="text-muted-foreground">
                  Say a few sentences in your normal voice for {CALIBRATION_SECONDS} seconds. If this microphone makes your own voice
                  look synthetic, the alarm is raised only for voices that score clearly higher than yours.
                </p>
                {phase === 'calibrating' ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 font-medium"><Mic className="size-4 text-signal" /> Keep talking… {Math.max(0, CALIBRATION_SECONDS - elapsed)}s</p>
                    <LevelMeter level={level} />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => begin('calibrate')} className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium hover:border-foreground/30">
                      {baseline == null ? 'Calibrate with my voice' : 'Calibrate again'}
                    </button>
                    {baseline != null && (
                      <span className="text-muted-foreground">Your voice scored <span className="font-semibold text-foreground">{pct(baseline)}</span> on this mic.</span>
                    )}
                  </div>
                )}
                {unreliableMic && (
                  <p className="text-inconclusive">
                    This microphone makes your own voice look synthetic, so even alerts here are unreliable. Use “Call on this
                    computer” or “Play a recording” instead.
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={phase === 'calibrating'}
              onClick={() => begin('listen')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <AudioLines className="size-4" /> Start listening
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">How it works</h2>
              <ul className="space-y-2.5 text-sm">
                {[
                  'Every 2 seconds, the last 4 seconds of audio go to the voice model trained on cloned and synthetic speech.',
                  'Silence and background noise are skipped; only speech is scored.',
                  'The verdict uses the last few seconds of speech, so one odd moment can’t trigger an alarm.',
                  'Audio is analysed in memory and never stored.',
                ].map((t) => (
                  <li key={t} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{t}</li>
                ))}
              </ul>
            </div>
            <p className="rounded-2xl bg-secondary p-4 text-xs text-secondary-foreground">
              No detector catches every clone. If anything feels off, ask something only the real person would know, or hang up
              and call back on a number you already have. <Link to="/stay-safe" className="underline">More on staying safe</Link>
            </p>
          </div>
        </div>
      )}

      {(phase === 'listening' || phase === 'done') && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <section
              className="space-y-4 rounded-3xl border bg-card p-6"
              style={{ borderTop: `4px solid var(--${st.tone === 'muted' ? 'border' : st.tone})` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <st.icon className={cn('size-10 shrink-0', TONE_TEXT[st.tone], st.spin && 'animate-spin')} />
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight">{phase === 'done' && verdict.state === 'warming' ? 'Not enough speech to judge' : st.title}</h2>
                    <p className="max-w-xl text-sm text-muted-foreground">{st.text}</p>
                    {alertedAt != null && (
                      <p className="text-xs font-medium text-manipulated">First flagged at {Math.floor(alertedAt / 60)}:{String(alertedAt % 60).padStart(2, '0')}</p>
                    )}
                  </div>
                </div>
                {verdict.score != null && (
                  <div className="text-right">
                    <p className={cn('text-4xl font-bold tabular-nums', TONE_TEXT[st.tone])}>{pct(verdict.score)}</p>
                    <p className="text-xs text-muted-foreground">{done ? 'synthetic voice, whole call' : 'synthetic voice, last few seconds'}</p>
                  </div>
                )}
              </div>
              {live && <LevelMeter level={level} />}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>{phase === 'done' ? 'Listened for' : 'Listening'} {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
                <span>{verdict.speechCount} speech window{verdict.speechCount === 1 ? '' : 's'} scored</span>
                {verdict.peak != null && <span>Peak {pct(verdict.peak)}</span>}
                <span>Alert above {pct(verdict.threshold)}</span>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border bg-card p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Timeline</h3>
                <span className="text-xs text-muted-foreground">each bar is a 4-second window, grey means no speech</span>
              </div>
              <Timeline entries={entries} />
            </section>

            {phase === 'done' && (
              <button type="button" onClick={() => { setPhase('idle'); setEntries([]) }} className="rounded-lg border px-4 py-2 text-sm font-medium hover:border-foreground/30">
                Start a new session
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className={cn('rounded-2xl border p-5', verdict.state === 'alert' ? 'border-manipulated/40 bg-manipulated/10' : 'bg-card')}>
              <h3 className="mb-3 text-sm font-semibold">If it turns red</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                <li>Don’t send money, OTPs or passwords during this call.</li>
                <li>Ask your family safe word, or something only they would know.</li>
                <li>Hang up and call back on a number you already have saved.</li>
                <li>Already paid? Call <span className="font-semibold">1930</span> right away.</li>
              </ol>
            </div>
            {unreliableMic && (
              <p className="rounded-2xl bg-inconclusive/10 p-4 text-xs text-inconclusive">
                Calibration showed this microphone makes your own voice look synthetic ({pct(baseline)}), so even alerts here are unreliable.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
