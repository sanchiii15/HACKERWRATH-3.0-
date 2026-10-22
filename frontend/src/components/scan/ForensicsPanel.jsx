import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Copy, FileBadge, Info, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { RISK_LEVELS, formatDate, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

const FLAGS = {
  ok: { label: 'No concern', icon: CheckCircle2, color: 'var(--authentic)', className: 'bg-authentic/15 text-authentic' },
  mixed: { label: 'Unclear', icon: AlertTriangle, color: 'var(--inconclusive)', className: 'bg-inconclusive/15 text-inconclusive' },
  concern: { label: 'Concern', icon: ShieldAlert, color: 'var(--manipulated)', className: 'bg-manipulated/15 text-manipulated' },
  info: { label: 'Info', icon: Info, color: 'var(--muted-foreground)', className: 'bg-muted text-muted-foreground' },
}

function EvidenceCard({ item, index }) {
  const flag = FLAGS[item.flag] ?? FLAGS.info
  const Icon = flag.icon
  return (
    <div
      className="animate-rise space-y-2 rounded-xl border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-navy/5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{item.label}</p>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', flag.className)}>
          <Icon className="size-3" /> {flag.label}
        </span>
      </div>
      {item.flag !== 'info' && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full animate-grow-x rounded-full" style={{ width: `${item.score * 100}%`, background: flag.color }} />
        </div>
      )}
      <p className="text-sm text-muted-foreground">{item.detail}</p>
    </div>
  )
}

function Stats({ rows }) {
  return (
    <Table>
      <TableBody>
        {rows.filter(([, v]) => v != null).map(([k, v]) => (
          <TableRow key={k}>
            <TableCell className="text-muted-foreground">{k}</TableCell>
            <TableCell className="text-right font-mono text-xs">{v}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function ForensicsPanel({ forensics }) {
  if (!forensics) return <p className="text-sm text-muted-foreground">This scan was made before forensic checks were added.</p>
  const { evidence = [], audio, timing, cuts, provenance, matches = [], errors = [] } = forensics

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Signal-level checks that need no AI model. Each one can be fooled or triggered by normal editing, so treat them as
        supporting evidence. Overall forensic signal: <span className="font-semibold text-foreground">{pct(forensics.score)}</span>.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {evidence.map((e, i) => <EvidenceCard key={e.key} item={e} index={i} />)}
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        {audio && (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">Audio signal</CardTitle>
              <CardDescription>First {Math.round(audio.seconds)}s analysed</CardDescription>
            </CardHeader>
            <CardContent>
              <Stats rows={[
                ['Sample rate', `${(audio.sampleRate / 1000).toFixed(1)} kHz`],
                ['Effective bandwidth', `${(audio.bandwidthHz / 1000).toFixed(1)} kHz (${audio.bandwidthClass})`],
                ['Noise floor', `${audio.noiseFloorDb} dBFS`],
                ['Digital silence', pct(audio.digitalSilence, 1)],
                ['Clipped samples', pct(audio.clippingRatio, 2)],
              ]} />
            </CardContent>
          </Card>
        )}
        {(timing || cuts) && (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">Video timing</CardTitle>
              <CardDescription>Cuts and gaps also appear on the Timeline tab</CardDescription>
            </CardHeader>
            <CardContent>
              <Stats rows={[
                ['Frames checked', timing?.frames],
                ['Measured frame rate', timing?.measuredFps ? `${timing.measuredFps.toFixed(2)} fps` : null],
                ['Irregular intervals', timing ? pct(timing.irregularRatio, 1) : null],
                ['Hard scene cuts', cuts?.count],
              ]} />
            </CardContent>
          </Card>
        )}
        {provenance && (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><FileBadge className="size-4" /> Provenance</CardTitle>
              <CardDescription>C2PA Content Credentials and IPTC source type</CardDescription>
            </CardHeader>
            <CardContent>
              <Stats rows={[
                ['C2PA manifest', provenance.c2paPresent ? 'Present (signature not verified)' : 'None'],
                ['Signed by', provenance.claimGenerator],
                ['Digital source type', provenance.digitalSourceType],
                ['Recorded actions', provenance.actions?.length ? provenance.actions.map((a) => a.replace('c2pa.', '')).join(', ') : null],
                ['Declares AI generation', provenance.aiDisclosed ? 'Yes' : 'No'],
              ]} />
            </CardContent>
          </Card>
        )}
        {matches.length > 0 && (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Copy className="size-4" /> Visually similar earlier scans</CardTitle>
              <CardDescription>Perceptual hash match, survives resizing and re-compression</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {matches.map((m) => {
                const level = m.riskLevel && RISK_LEVELS[m.riskLevel]
                return (
                  <Link key={m.scanId} to={`/scans/${m.scanId}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.originalName}</p>
                      <p className="text-xs text-muted-foreground">{Math.round((1 - m.distance / 64) * 100)}% similar · {formatDate(m.createdAt)}</p>
                    </div>
                    {level && <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', level.className)}>{level.label}</span>}
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {errors.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Skipped checks: {errors.map((e) => `${e.check} (${e.message})`).join('; ')}
        </p>
      )}
    </div>
  )
}
