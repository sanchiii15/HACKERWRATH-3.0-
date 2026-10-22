import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ShieldAlert, Sparkles } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import ScannerGraphic from '@/components/ScannerGraphic'
import { useCountUp } from '@/hooks/useCountUp'
import { getStats } from '@/lib/api'
import { MEDIA_TYPE_LIST, MEDIA_TYPES } from '@/lib/mediaTypes'
import { RISK_LEVELS, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const LEVEL_KEYS = ['low', 'medium', 'high', 'critical']

function Counter({ value, suffix = '', className }) {
  const n = useCountUp(value ?? 0)
  return <span className={cn('tabular-nums', className)}>{value == null ? '—' : `${Math.round(n)}${suffix}`}</span>
}

// Feeds the cursor position to the hero spotlight via CSS variables.
function trackPointer(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function Hero({ totals }) {
  return (
    <section
      onMouseMove={trackPointer}
      className="floating-panel group/hero relative overflow-hidden rounded-3xl bg-card text-foreground"
    >
      {/* Soft spotlight that follows the cursor */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/hero:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklch, var(--sky) 22%, transparent), transparent 70%)' }}
      />
      <div className="relative grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-foreground/[0.05] px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
            <Sparkles className="size-3.5" /> Robustness-tested deepfake screening
          </span>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Is that call, photo or voice note <span className="text-sky">real</span>?
            </h1>
            <p className="max-w-xl text-muted-foreground">
              Upload suspicious media and get a risk level, the most likely kind of manipulation, and how far the result
              can be trusted after compression. No bare &ldquo;fake&rdquo; labels.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {MEDIA_TYPE_LIST.map((m) => (
              <Link
                key={m.key}
                to={`/check/${m.key}`}
                className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky/20"
              >
                <m.icon className="size-4" />
                {m.label}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
          <dl className="grid max-w-md grid-cols-3 gap-4 border-t border-border pt-5">
            <div>
              <dt className="text-xs text-muted-foreground">Files screened</dt>
              <dd className="text-2xl font-semibold"><Counter value={totals?.total} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">High risk caught</dt>
              <dd className="text-2xl font-semibold"><Counter value={totals?.flagged} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Media types</dt>
              <dd className="text-2xl font-semibold"><Counter value={3} /></dd>
            </div>
          </dl>
        </div>
        <ScannerGraphic className="mx-auto hidden w-full max-w-[260px] md:grid" />
      </div>
    </section>
  )
}

// Thin stacked bar of risk levels for one media type.
function LevelBar({ levels }) {
  const total = LEVEL_KEYS.reduce((n, k) => n + (levels?.[k] ?? 0), 0)
  if (!total) return <div className="h-2 rounded-full bg-muted" />
  return (
    <div className="flex h-2 animate-grow-x overflow-hidden rounded-full bg-muted">
      {LEVEL_KEYS.map((k) =>
        levels[k] ? (
          <div key={k} style={{ width: `${(levels[k] / total) * 100}%`, background: RISK_LEVELS[k].color }} title={`${RISK_LEVELS[k].label}: ${levels[k]}`} />
        ) : null,
      )}
    </div>
  )
}

function ModuleCard({ mediaType, stats, index }) {
  const Icon = mediaType.icon
  return (
    <Link
      to={`/check/${mediaType.key}`}
      className="group relative flex animate-rise flex-col gap-5 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-xl hover:shadow-navy/10"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-foreground/40 transition-transform duration-500 group-hover:scale-x-100" />
      <div className="flex items-start justify-between">
        <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-navy/20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
          <Icon className="size-6" />
        </span>
        <ArrowUpRight className="size-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{mediaType.label}</h3>
        <p className="text-sm text-muted-foreground">{mediaType.tagline}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-2xl font-semibold"><Counter value={stats?.total ?? 0} /></p>
          <p className="text-xs text-muted-foreground">Scanned</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-manipulated"><Counter value={stats?.flagged ?? 0} /></p>
          <p className="text-xs text-muted-foreground">High risk</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">
            <Counter value={stats?.avgScore != null ? stats.avgScore * 100 : null} suffix="%" />
          </p>
          <p className="text-xs text-muted-foreground">Avg. likelihood</p>
        </div>
      </div>
      <LevelBar levels={stats?.levels} />
      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
        Start {mediaType.label.toLowerCase()}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  )
}

function RiskDistribution({ mediaTypes }) {
  const data = MEDIA_TYPE_LIST.map((m) => ({ name: m.label.replace(' check', ''), ...mediaTypes[m.key].levels }))
  const empty = data.every((d) => LEVEL_KEYS.every((k) => !d[k]))
  return (
    <Card className="transition-shadow hover:shadow-lg hover:shadow-navy/5">
      <CardHeader>
        <CardTitle>Risk levels by media type</CardTitle>
        <CardDescription>Completed scans only · hover a bar for details</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No completed scans yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--accent)', radius: 8 }} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                {LEVEL_KEYS.map((k, i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={RISK_LEVELS[k].label}
                    stackId="risk"
                    fill={RISK_LEVELS[k].color}
                    radius={i === LEVEL_KEYS.length - 1 ? [6, 6, 0, 0] : 0}
                    animationDuration={900}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecentScans({ recent }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent scans</CardTitle>
        <CardDescription>
          <Link to="/history" className="font-medium text-foreground hover:underline">View all history →</Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {recent.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">Nothing scanned yet.</p>}
        {recent.map((s, i) => {
          const Icon = MEDIA_TYPES[s.mediaType]?.icon
          const level = s.risk?.level && RISK_LEVELS[s.risk.level]
          return (
            <Link
              key={s._id}
              to={`/scans/${s._id}`}
              className="group flex animate-rise items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-accent"
              style={{ animationDelay: `${200 + i * 60}ms` }}
            >
              {Icon && (
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.originalName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.risk?.headline ?? s.status} · {formatDate(s.createdAt)}
                </p>
              </div>
              {level ? (
                <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', level.className)}>{level.label}</span>
              ) : (
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{s.status}</span>
              )}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStats().then(setStats).catch((e) => setError(e.message))
  }, [])

  const totals = stats && Object.values(stats.mediaTypes).reduce(
    (acc, t) => ({ total: acc.total + t.total, flagged: acc.flagged + t.flagged }),
    { total: 0, flagged: 0 },
  )

  return (
    <div className="space-y-8">
      <Hero totals={totals} />

      {error && (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertDescription>Couldn&rsquo;t load statistics: {error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Choose a check</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {MEDIA_TYPE_LIST.map((m, i) => (
            <ModuleCard key={m.key} mediaType={m} stats={stats?.mediaTypes[m.key]} index={i} />
          ))}
        </div>
      </section>

      {stats ? (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <RiskDistribution mediaTypes={stats.mediaTypes} />
          <RecentScans recent={stats.recent} />
        </div>
      ) : (
        !error && <Skeleton className="h-72 w-full rounded-2xl" />
      )}
    </div>
  )
}
