import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pct } from '@/lib/format'

const FRAME_THRESHOLD = 0.7

// Frame variants are named "frame@12.5s" by the backend.
function parseFrames(variants) {
  return variants
    .map((v) => ({ time: Number(v.name.match(/frame@([\d.]+)s/)?.[1]), score: v.score }))
    .filter((f) => Number.isFinite(f.time) && typeof f.score === 'number')
}

export default function FrameTimelineChart({ frames, margin, onSeek }) {
  const data = parseFrames(frames.variants).map((f) => ({
    ...f,
    range: [Math.max(0, f.score - margin), Math.min(1, f.score + margin)],
  }))
  if (!data.length) return null

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Per-frame score</CardTitle>
        <CardDescription>
          {data.length} sampled frames · frames above {pct(FRAME_THRESHOLD)} are flagged · click to seek
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              onClick={(e) => e?.activeLabel != null && onSeek?.(Number(e.activeLabel))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t) => `${t.toFixed(0)}s`} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => pct(v)} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                formatter={(value, name) => (name === 'range' ? `${pct(value[0])}–${pct(value[1])}` : pct(value, 1))}
                labelFormatter={(t) => `${Number(t).toFixed(1)}s`}
                contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              />
              <ReferenceLine y={FRAME_THRESHOLD} stroke="var(--manipulated)" strokeDasharray="4 4" />
              <Area dataKey="range" type="monotone" stroke="none" fill="var(--primary)" fillOpacity={0.15} isAnimationActive={false} />
              <Line dataKey="score" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
