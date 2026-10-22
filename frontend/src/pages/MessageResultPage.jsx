import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Link2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getMessage } from '@/lib/api'
import { RISK_LEVELS, formatDate, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONS = { low: ShieldCheck, medium: ShieldQuestion, high: ShieldAlert, critical: ShieldAlert }

// Colour for a 0–1 score: green below 30%, amber below 60%, red above.
const tone = (score) => (score < 0.3 ? 'authentic' : score < 0.6 ? 'inconclusive' : 'manipulated')
const TONE_CLASS = {
  authentic: 'bg-authentic/15 text-authentic',
  inconclusive: 'bg-inconclusive/15 text-inconclusive',
  manipulated: 'bg-manipulated/15 text-manipulated',
}

function Verdict({ risk }) {
  const level = RISK_LEVELS[risk.level]
  const Icon = ICONS[risk.level]
  return (
    <section className="animate-rise space-y-4 rounded-3xl border bg-card p-6" style={{ borderTop: `4px solid ${level.color}` }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase', level.className)}>
            <Icon className="size-3.5" /> {level.label}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{risk.headline}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{risk.action}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums" style={{ color: level.color }}>{pct(risk.score)}</p>
          <p className="text-xs text-muted-foreground">scam likelihood</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${risk.score * 100}%`, background: level.color }} />
      </div>
      {risk.reasons?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {risk.reasons.map((r) => (
            <span key={r} className="rounded-full border px-2.5 py-1 text-xs">{r}</span>
          ))}
        </div>
      )}
    </section>
  )
}

// Splits the text into plain runs, highlighted scam phrases and link spans (links win on overlap).
function segments(text, signals, links) {
  const ranges = [
    ...links.map((l) => ({ start: l.start, end: l.end, kind: 'link', score: l.score, title: `Link: ${l.domain}` })),
    ...signals.flatMap((s) => s.matches.map((m) => ({ start: m.start, end: m.end, kind: 'signal', score: s.weight, title: s.label }))),
  ].sort((a, b) => a.start - b.start || (a.kind === 'link' ? -1 : 1))

  const out = []
  let pos = 0
  for (const r of ranges) {
    if (r.start < pos) continue
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) })
    out.push({ ...r, text: text.slice(r.start, r.end) })
    pos = r.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
}

function HighlightedMessage({ message }) {
  const parts = segments(message.text, message.signals ?? [], message.links ?? [])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">The message</CardTitle>
        <CardDescription>Hover a highlight to see why it was flagged.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="rounded-xl bg-muted/50 p-4 text-sm leading-7 break-words whitespace-pre-wrap">
          {parts.map((p, i) => {
            if (!p.kind) return <span key={i}>{p.text}</span>
            const t = tone(p.score)
            if (p.kind === 'link') {
              return (
                <span key={i} title={p.title} className={cn('rounded px-1 font-mono text-[0.85em] underline decoration-dotted underline-offset-4', TONE_CLASS[t])}>
                  {p.text}
                </span>
              )
            }
            return (
              <mark key={i} title={p.title} className={cn('rounded px-0.5', TONE_CLASS[t === 'authentic' ? 'inconclusive' : t])}>
                {p.text}
              </mark>
            )
          })}
        </p>
      </CardContent>
    </Card>
  )
}

function Signals({ signals }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Warning signs in the text</CardTitle>
        <CardDescription>{signals.length ? `${signals.length} found` : 'None of the common scam phrases were found.'}</CardDescription>
      </CardHeader>
      {signals.length > 0 && (
        <CardContent className="space-y-3">
          {signals.map((s) => (
            <div key={s.key} className="space-y-1 border-l-2 pl-3" style={{ borderColor: `var(--${tone(s.weight) === 'authentic' ? 'inconclusive' : tone(s.weight)})` }}>
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.detail}</p>
              <p className="text-xs">
                {s.matches.slice(0, 4).map((m) => (
                  <span key={m.start} className="mr-1.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono">“{m.text}”</span>
                ))}
              </p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

function age(link) {
  if (link.ageDays == null) return 'Unknown'
  const when = new Date(link.registered).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  if (link.ageDays < 60) return `${when} · ${link.ageDays} days ago`
  if (link.ageDays < 730) return `${when} · ${Math.round(link.ageDays / 30)} months ago`
  return `${when} · ${Math.floor(link.ageDays / 365)} years ago`
}

function LinkCard({ link }) {
  const t = tone(link.score)
  const finalDiffers = link.finalUrl && new URL(link.finalUrl).href !== new URL(link.url).href
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate font-mono text-sm" title={link.domain}>{link.domain}</CardTitle>
            <CardDescription className="truncate font-mono text-xs" title={link.url}>{link.raw}</CardDescription>
          </div>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', TONE_CLASS[t])}>{pct(link.score)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Goes to</dt>
          <dd className={cn(link.fetchError ? 'text-muted-foreground' : 'truncate font-mono')} title={link.finalUrl}>
            {link.fetchError ? `Not opened: ${link.fetchError}` : finalDiffers ? link.finalUrl : 'Same address'}
          </dd>
          {link.redirects?.length > 1 && (
            <>
              <dt className="text-muted-foreground">Redirects</dt>
              <dd>{link.redirects.length - 1} hop{link.redirects.length > 2 ? 's' : ''}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Registered</dt>
          <dd>{age(link)}</dd>
        </dl>
        {link.flags?.length > 0 ? (
          <ul className="space-y-1.5">
            {link.flags.map((f) => (
              <li key={f.key + f.label} className="flex gap-2" title={f.detail}>
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: `var(--${tone(f.score)})` }} />
                <span>
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-authentic" /> No warning signs for this link.</p>
        )}
        {link.mediaScan?.scanId && (
          <Link to={`/scans/${link.mediaScan.scanId}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:border-foreground/30">
            This link is a {link.mediaType} file. See its deepfake check
            <ArrowRight className="size-4" />
          </Link>
        )}
        {link.mediaScan?.skipped && <p className="text-xs text-muted-foreground">Media file not scanned: {link.mediaScan.skipped}</p>}
      </CardContent>
    </Card>
  )
}

export default function MessageResultPage() {
  const { id } = useParams()
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getMessage(id).then(setMessage).catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load this check</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (!message) return <Skeleton className="h-64 w-full" />

  const links = message.links ?? []

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/check/message" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Check another message
        </Link>
        <p className="text-sm text-muted-foreground">
          Message check · {formatDate(message.createdAt)} · {links.length} link{links.length === 1 ? '' : 's'}
        </p>
      </div>

      <Verdict risk={message.risk} />

      <div className="grid animate-rise items-start gap-4 [animation-delay:120ms] lg:grid-cols-[3fr_2fr]">
        <HighlightedMessage message={message} />
        <Signals signals={message.signals ?? []} />
      </div>

      {links.length > 0 && (
        <section className="animate-rise space-y-3 [animation-delay:240ms]">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Link2 className="size-5" /> Links</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {links.map((l) => <LinkCard key={l.url} link={l} />)}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-5">
        <p className="flex-1 text-sm text-muted-foreground">Already paid or shared details? Act quickly.</p>
        <Link to="/stay-safe" className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:border-foreground/30">
          What to do now <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
