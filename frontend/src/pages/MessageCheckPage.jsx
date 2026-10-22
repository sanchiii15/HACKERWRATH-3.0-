import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckHeader, CheckInfo } from '@/components/CheckLayout'
import { checkMessage } from '@/lib/api'
import { MESSAGE_CHECK } from '@/lib/mediaTypes'

const MAX = 5000

// Realistic examples so the check can be tried without a real scam message to hand.
const EXAMPLES = [
  {
    label: 'Fake bank alert',
    text: 'URGENT: Your SBI account will be blocked today. Update KYC immediately at http://sbi-kyc-update.top/login and share the OTP sent to you. Don\'t tell anyone.',
  },
  {
    label: 'Boss asking for gift cards',
    text: "Hi, this is your CEO. I'm stuck in a meeting and need you to buy 5 Google Play gift cards of Rs 5000 each right now. Keep this between us. Message me on WhatsApp once done.",
  },
  {
    label: 'Normal message',
    text: "Hey! Are we still on for lunch tomorrow at 1? Here's the place: https://www.google.com/maps",
  },
]

export default function MessageCheckPage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const message = await checkMessage(text)
      navigate(`/messages/${message._id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <CheckHeader check={MESSAGE_CHECK} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-2xl border bg-card p-4 shadow-sm focus-within:border-foreground/30">
            <label htmlFor="message-text" className="mb-2 block text-sm font-medium">
              Paste the message, email or link
            </label>
            <textarea
              id="message-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              rows={9}
              disabled={busy}
              placeholder="e.g. “Your account will be blocked today. Verify at http://…”"
              className="w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Try an example:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    disabled={busy}
                    onClick={() => setText(ex.text)}
                    className="rounded-full border px-2.5 py-1 transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">{text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
                <button
                  type="submit"
                  disabled={busy || !text.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {busy ? 'Checking links…' : 'Check message'}
                </button>
              </div>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-foreground" />
            Links are followed by the server to read where they lead; pages are never opened in your browser.
          </p>
        </form>

        <CheckInfo
          check={MESSAGE_CHECK}
          note="Each warning sign is highlighted in the message itself, so you can see exactly what made it look suspicious."
        />
      </div>
    </div>
  )
}
