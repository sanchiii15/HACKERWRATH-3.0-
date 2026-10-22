import { AlertTriangle, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BANDS, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

// Horizontal 0–100% scale showing the point estimate and its uncertainty range,
// with the authentic / inconclusive / manipulated zones shaded behind it.
function BandScale({ confidence }) {
  const { score, low, high } = confidence
  const band = BANDS[confidence.band]
  return (
    <div className="space-y-1.5">
      <div className="relative h-8 overflow-hidden rounded-md">
        <div className="absolute inset-y-0 left-0 w-[35%] bg-authentic/15" />
        <div className="absolute inset-y-0 left-[35%] w-[30%] bg-inconclusive/15" />
        <div className="absolute inset-y-0 right-0 w-[35%] bg-manipulated/15" />
        <div
          className="absolute inset-y-1.5 rounded"
          style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%`, background: band.color, opacity: 0.45 }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `calc(${score * 100}% - 1px)` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0% · authentic</span>
        <span>inconclusive</span>
        <span>manipulated · 100%</span>
      </div>
    </div>
  )
}

export default function ConfidenceCard({ confidence }) {
  const band = BANDS[confidence.band]
  const usesStub = confidence.reasons?.some((r) => r.includes('stub'))

  return (
    <Card>
      <CardHeader>
        <CardDescription>Assessment</CardDescription>
        <CardTitle className="flex flex-wrap items-baseline gap-3 text-2xl">
          <span className={cn('rounded-md px-2.5 py-1 text-lg', band.className)}>{band.label}</span>
          <span className="text-base font-normal text-muted-foreground">
            {pct(confidence.score)} likelihood of manipulation, range {pct(confidence.low)}–{pct(confidence.high)} (±
            {pct(confidence.margin)})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <BandScale confidence={confidence} />
        {confidence.reasons?.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {confidence.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                {r.includes('stub') ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-inconclusive" />
                ) : (
                  <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                {r}
              </li>
            ))}
          </ul>
        )}
        {usesStub && (
          <p className="text-xs text-muted-foreground">
            The pipeline is running without a trained model, so this result is a placeholder, not a real verdict.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
