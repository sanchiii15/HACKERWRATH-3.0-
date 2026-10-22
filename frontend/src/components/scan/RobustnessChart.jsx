import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pct } from '@/lib/format'

const LABELS = { video: 'Video detector', image: 'Image detector', audio: 'Voice detector' }

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{d.name}</p>
      {d.description && <p className="text-muted-foreground">{d.description}</p>}
      {d.error ? <p className="text-manipulated">Failed: {d.error}</p> : <p>Score {pct(d.score, 1)} (range {pct(d.range[0])}–{pct(d.range[1])})</p>}
    </div>
  )
}

// One modality's score on the original upload vs. each stress-test variant,
// with the reported error margin drawn as a shaded area around the line.
function ModalityChart({ modality, result, margin }) {
  const data = result.variants.map((v) => ({
    ...v,
    range: typeof v.score === 'number' ? [Math.max(0, v.score - margin), Math.min(1, v.score + margin)] : null,
  }))

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{LABELS[modality]}</CardTitle>
        <CardDescription>
          Mean {pct(result.score, 1)} · shift under re-encoding {pct(result.robustnessSpread, 1)}
          {result.engine === 'stub' && ' · stub engine'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <ReferenceArea y1={0} y2={0.35} fill="var(--authentic)" fillOpacity={0.06} />
              <ReferenceArea y1={0.65} y2={1} fill="var(--manipulated)" fillOpacity={0.06} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval={0} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => pct(v)} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Area dataKey="range" stroke="none" fill="var(--primary)" fillOpacity={0.15} isAnimationActive={false} />
              <Line dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export default function RobustnessChart({ results, margin, mediaType }) {
  // For videos, results.image holds per-frame scores, which get their own timeline chart.
  const entries = Object.entries(results ?? {}).filter(
    ([m, r]) => r?.variants?.length && !(mediaType === 'video' && m === 'image'),
  )
  if (!entries.length) return <p className="text-sm text-muted-foreground">No detector results.</p>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {entries.map(([m, r]) => (
        <ModalityChart key={m} modality={m} result={r} margin={margin} />
      ))}
    </div>
  )
}
