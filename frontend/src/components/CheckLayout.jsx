import { Link } from 'react-router-dom'
import { CheckCircle2, Target } from 'lucide-react'
import { CHECK_LIST } from '@/lib/mediaTypes'
import { cn } from '@/lib/utils'

// Header panel shared by every check page: icon, title, tagline and a switcher between checks.
export function CheckHeader({ check }) {
  const Icon = check.icon
  return (
    <section className="floating-panel relative overflow-hidden rounded-3xl bg-card p-6 text-foreground sm:p-8">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 animate-float place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Icon className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{check.label}</h1>
            <p className="text-muted-foreground">{check.tagline}</p>
          </div>
        </div>
        {/* Switch between checks without going back to the dashboard */}
        <div className="flex gap-1 self-start overflow-x-auto rounded-xl bg-foreground/[0.05] p-1 ring-1 ring-border lg:self-auto">
          {CHECK_LIST.map((m) => (
            <Link
              key={m.key}
              to={`/check/${m.key}`}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all',
                m.key === check.key ? 'bg-primary font-medium text-primary-foreground shadow' : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
              )}
            >
              <m.icon className="size-4" />
              {m.label.replace(' check', '')}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function InfoPanel({ title, icon: Icon, items, delay }) {
  return (
    <div className="animate-rise rounded-2xl border bg-card p-5 shadow-sm" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {items.map((item, i) => (
          <li
            key={item}
            className="flex animate-rise gap-2.5 rounded-lg p-1 transition-colors hover:bg-accent"
            style={{ animationDelay: `${delay + 80 + i * 60}ms` }}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Right-hand column on every check page: what the check does and what it looks for.
export function CheckInfo({ check, note }) {
  return (
    <div className="space-y-4">
      <InfoPanel title="What this check does" icon={CheckCircle2} items={check.checks} delay={80} />
      <InfoPanel title="What it looks for" icon={Target} items={check.detects} delay={200} />
      {note && (
        <p className="animate-rise rounded-2xl bg-secondary p-4 text-xs text-secondary-foreground [animation-delay:400ms]">{note}</p>
      )}
    </div>
  )
}
