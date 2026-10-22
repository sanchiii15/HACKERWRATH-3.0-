import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { pct } from '@/lib/format'

const color = (p) => (p >= 0.65 ? 'var(--manipulated)' : p >= 0.35 ? 'var(--inconclusive)' : 'var(--authentic)')

// Breakdown of which kind of manipulation the detectors think is most likely.
export default function ManipulationTypes({ types, primaryType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Suspected manipulation type</CardTitle>
        <CardDescription>Detector probability for each technique, on the original file</CardDescription>
      </CardHeader>
      <CardContent>
        {!types?.length ? (
          <p className="text-sm text-muted-foreground">The detector didn&rsquo;t report a breakdown by technique.</p>
        ) : (
          <ul className="space-y-3">
            {types.map((t, i) => (
              <li key={t.key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={t.key === primaryType ? 'font-semibold' : undefined}>
                    {t.label}
                    {t.key === primaryType && <span className="ml-2 text-xs font-normal text-muted-foreground">most likely</span>}
                  </span>
                  <span className="tabular-nums">{pct(t.probability)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full animate-grow-x rounded-full" style={{ width: `${t.probability * 100}%`, background: color(t.probability), animationDelay: `${i * 90}ms` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
