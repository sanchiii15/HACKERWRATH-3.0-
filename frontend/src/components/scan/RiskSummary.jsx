import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'
import { RISK_LEVELS } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONS = { low: ShieldCheck, medium: ShieldQuestion, high: ShieldAlert, critical: ShieldAlert }
const R = 52
const CIRC = 2 * Math.PI * R

// Animated ring showing the manipulation likelihood, with the uncertainty range as a faint arc.
function Gauge({ confidence, color }) {
  const value = useCountUp(confidence.score * 100, 1200)
  const rangeStart = confidence.low * CIRC
  const rangeLen = (confidence.high - confidence.low) * CIRC
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="10"
          strokeDasharray={`${rangeLen} ${CIRC}`} strokeDashoffset={-rangeStart}
        />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - value / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-3xl font-bold tabular-nums">{Math.round(value)}%</span>
        <span className="text-[11px] text-muted-foreground">likelihood</span>
      </div>
    </div>
  )
}

// Top-of-page verdict: what kind of manipulation is suspected, how risky, and what to do.
export default function RiskSummary({ risk, confidence }) {
  const level = RISK_LEVELS[risk.level]
  const Icon = ICONS[risk.level]
  return (
    <section
      className="relative animate-rise overflow-hidden rounded-3xl border bg-card p-6 shadow-lg shadow-navy/5"
      style={{ borderTop: `4px solid ${level.color}` }}
    >
      <div className="absolute -top-20 -right-20 size-56 rounded-full blur-3xl" style={{ background: level.color, opacity: 0.12 }} />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row">
        <Gauge confidence={confidence} color={level.color} />
        <div className="space-y-3 text-center sm:text-left">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide', level.className)}>
            <Icon className="size-3.5" /> {level.label}
          </span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{risk.headline}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{risk.action}</p>
          <p className="text-xs text-muted-foreground">
            Range {Math.round(confidence.low * 100)}–{Math.round(confidence.high * 100)}% (shaded arc) · ±{Math.round(confidence.margin * 100)}% margin
          </p>
        </div>
      </div>
    </section>
  )
}
