import { useState } from 'react'
import { Check, HelpCircle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { sendFeedback } from '@/lib/api'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { label: 'authentic', text: "It's real", icon: ShieldCheck, className: 'hover:border-authentic hover:bg-authentic/10' },
  { label: 'manipulated', text: "It's manipulated", icon: ShieldAlert, className: 'hover:border-manipulated hover:bg-manipulated/10' },
  { label: 'unsure', text: 'Not sure', icon: HelpCircle, className: 'hover:border-foreground/25 hover:bg-accent' },
]

// Lets users report the true answer; collected to measure accuracy and improve the detectors.
export default function FeedbackBox({ scanId, initialCount = 0 }) {
  const [choice, setChoice] = useState(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState(null)
  const [count, setCount] = useState(initialCount)

  async function submit() {
    setState('sending')
    setError(null)
    try {
      const { feedback } = await sendFeedback(scanId, { label: choice, note: note.trim() || undefined })
      setCount(feedback.length)
      setState('sent')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex animate-rise items-center gap-3 rounded-2xl border bg-card p-4 text-sm">
        <span className="grid size-8 place-items-center rounded-full bg-authentic/15 text-authentic"><Check className="size-4" /></span>
        Thanks, your answer was saved. It helps measure how often the detectors are right.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">Do you know the real answer?</p>
        {count > 0 && <p className="text-xs text-muted-foreground">{count} answer(s) recorded</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(({ label, text, icon: Icon, className }) => (
          <button
            key={label}
            type="button"
            onClick={() => setChoice(label)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all',
              className,
              choice === label && 'border-primary bg-primary text-primary-foreground hover:bg-primary',
            )}
          >
            <Icon className="size-4" /> {text}
          </button>
        ))}
      </div>
      {choice && (
        <div className="flex animate-rise flex-col gap-2 sm:flex-row">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Optional: how do you know?"
            className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={state === 'sending'}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {state === 'sending' ? 'Saving…' : 'Submit'}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-manipulated">{error}</p>}
    </div>
  )
}
