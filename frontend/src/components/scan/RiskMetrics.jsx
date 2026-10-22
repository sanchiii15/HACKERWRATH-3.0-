import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pct } from '@/lib/format'

const LEVEL_COLORS = { low: 'var(--authentic)', medium: 'var(--inconclusive)', high: 'var(--manipulated)' }
const LEVEL_TEXT = { low: 'Low', medium: 'Medium', high: 'High' }
// Radar axis labels need to be short to fit around the chart.
const SHORT_LABELS = {
  manipulation: 'Likelihood',
  uncertainty: 'Uncertainty',
  fragility: 'Fragility',
  disagreement: 'Disagreement',
  provenance: 'Provenance',
  timeline: 'Timeline',
}

function MetricTile({ metric }) {
  const color = LEVEL_COLORS[metric.level]
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-navy/30 hover:shadow-md hover:shadow-navy/5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{metric.label}</p>
        <p className="text-sm font-semibold tabular-nums" style={{ color }}>{pct(metric.value)}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full animate-grow-x rounded-full" style={{ width: `${metric.value * 100}%`, background: color }} />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium" style={{ color }}>{LEVEL_TEXT[metric.level]}</span> · {metric.detail}
      </p>
    </div>
  )
}

// Every metric is scaled so 0 = no risk and 1 = maximum risk, so the radar reads consistently.
export default function RiskMetrics({ metrics }) {
  const data = metrics.map((m) => ({ label: SHORT_LABELS[m.key] ?? m.label, value: m.value }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Risk metrics</CardTitle>
        <CardDescription>Each metric runs from 0% (no concern) to 100% (strong concern)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="65%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="var(--chart-2)" strokeWidth={2} fill="var(--chart-2)" fillOpacity={0.3} animationDuration={900} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {metrics.map((m) => <MetricTile key={m.key} metric={m} />)}
        </div>
      </CardContent>
    </Card>
  )
}
