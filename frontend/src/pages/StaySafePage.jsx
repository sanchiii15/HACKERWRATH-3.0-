import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AudioLines, Check, Copy, KeyRound, MessageSquareWarning, PhoneCall, ShieldAlert, Video } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const RIGHT_NOW = [
  { title: 'Pause', text: 'Don’t send money, share an OTP or PIN, or click a link while you’re still on the call or chat.' },
  { title: 'Call back on a number you already have', text: 'Hang up and call the person yourself, using a number saved before this message arrived, not one they gave you.' },
  { title: 'Ask something only they would know', text: 'A shared memory or your family safe word. A cloned voice can copy how someone sounds, not what they know.' },
  { title: 'Check with someone else', text: 'A colleague, family member or the person’s manager. Scammers rely on you deciding alone and fast.' },
  { title: 'Keep the evidence', text: 'Screenshots, the phone number or account, payment details and the file itself. Then scan the file here.' },
]

const ALREADY_PAID = [
  { title: 'Call 1930 immediately', text: 'India’s National Cyber Crime Helpline. Reporting within the first hours gives the best chance of freezing the money.' },
  { title: 'Call your bank', text: 'Use the number on your card or banking app to block the card, UPI or account and dispute the payment.' },
  { title: 'File a complaint online', text: 'Register it on the National Cyber Crime Reporting Portal, cybercrime.gov.in, and note the acknowledgement number.' },
  { title: 'Secure your accounts', text: 'Change passwords you may have shared, sign out other devices, and turn on two-factor authentication.' },
  { title: 'Report the account', text: 'Report the profile or number on the platform it came from (WhatsApp, Instagram, Telegram…) so others are warned.' },
]

const SIGNS = [
  {
    icon: Video,
    title: 'On a video call',
    items: [
      'Edges of the face blur or flicker when they move or turn their head',
      'Lips slightly out of sync with the words',
      'Lighting on the face doesn’t match the room',
      'They keep the camera far away or blame a “bad connection” for poor quality',
    ],
  },
  {
    icon: AudioLines,
    title: 'In a voice call or note',
    items: [
      'Flat or oddly even emotion, even when the message is urgent',
      'Unusual pauses, clipped words or a robotic edge',
      'Complete silence behind the voice, with no room noise at all',
      'A familiar voice from an unfamiliar number',
    ],
  },
  {
    icon: MessageSquareWarning,
    title: 'In the request itself',
    items: [
      'Pressure to act now, and to keep it secret',
      'Payment to a new account, gift cards or crypto',
      'Asking for an OTP, PIN or password',
      'Moving the conversation to another app',
    ],
  },
]

const PREVENT = [
  { icon: KeyRound, title: 'Agree a family safe word', text: 'A word only your family knows, to confirm it’s really them in an emergency call.' },
  { icon: PhoneCall, title: 'Set a rule at work', text: 'Any payment or bank-detail change requested by call or message must be confirmed through a second, known channel.' },
  { icon: ShieldAlert, title: 'Share less of your voice and face', text: 'Limit public videos and voice notes; a few seconds of clear audio is enough to clone a voice.' },
]

const CONTACTS = [
  { label: 'Cyber Crime Helpline (India)', value: '1930' },
  { label: 'Cyber crime reporting portal', value: 'cybercrime.gov.in', href: 'https://cybercrime.gov.in' },
  { label: 'Report fraud calls and messages (Chakshu)', value: 'sancharsaathi.gov.in', href: 'https://sancharsaathi.gov.in' },
]

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable; the value is selectable text anyway
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={`Copy ${value}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
      {copied ? <Check className="size-4 text-authentic" /> : <Copy className="size-4" />}
    </button>
  )
}

function Steps({ items, accent }) {
  return (
    <ol className="grid gap-3">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-3 rounded-2xl border bg-card p-4">
          <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${accent}`}>{i + 1}</span>
          <div className="space-y-1">
            <p className="font-medium">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function StaySafePage() {
  return (
    <div className="space-y-12">
      <section className="floating-panel relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-deep to-navy p-6 text-white sm:p-10">
        <div className="absolute -right-10 -bottom-16 size-56 rounded-full bg-sky/20 blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[1fr_320px] md:items-center">
          <div className="space-y-3">
            <p className="text-sm font-medium text-sky">Stay safe</p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">Think it’s a deepfake? Do this before anything else.</h1>
            <p className="text-white/75">
              Detection helps, but the strongest protection is checking through a channel the scammer doesn’t control.
              These steps work even when a fake is too good to spot.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 text-navy-deep shadow-lg">
            <p className="text-sm font-medium">Money already sent or details shared?</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">Call 1930</p>
            <p className="mt-1 text-sm text-navy/70">National Cyber Crime Helpline, India. Report as early as possible.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">If you’re unsure right now</h2>
          <Steps items={RIGHT_NOW} accent="bg-navy text-white dark:bg-white dark:text-navy" />
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">If you already paid or shared details</h2>
          <Steps items={ALREADY_PAID} accent="bg-manipulated text-white" />
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Warning signs</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SIGNS.map((g) => (
            <Card key={g.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><g.icon className="size-4" />{g.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {g.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Good fakes may show none of these, so treat the request itself as the strongest signal.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Make yourself harder to fake</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PREVENT.map((p) => (
            <div key={p.title} className="space-y-2 rounded-2xl border bg-card p-5">
              <p.icon className="size-5 text-navy dark:text-sky" />
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Where to report</h2>
        <div className="divide-y rounded-2xl border bg-card">
          {CONTACTS.map((c) => (
            <div key={c.label} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                {c.href ? (
                  <a href={c.href} target="_blank" rel="noreferrer" className="font-medium text-navy underline-offset-4 select-all hover:underline dark:text-sky">{c.value}</a>
                ) : (
                  <p className="font-mono text-lg font-semibold select-all">{c.value}</p>
                )}
              </div>
              <CopyButton value={c.value} />
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Outside India, contact your local police or national cybercrime unit, and your bank.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-5">
        <p className="flex-1 text-sm text-muted-foreground">Have the file? Check it before you decide.</p>
        <Link to="/" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90 dark:bg-white dark:text-navy">
          Scan a file
        </Link>
      </div>
    </div>
  )
}
