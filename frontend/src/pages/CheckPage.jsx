import { Link, Navigate, useParams } from 'react-router-dom'
import { CheckCircle2, ShieldCheck, Target } from 'lucide-react'
import MediaDropzone from '@/components/MediaDropzone'
import { MEDIA_TYPES, MEDIA_TYPE_LIST } from '@/lib/mediaTypes'
import { cn } from '@/lib/utils'

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
            <Icon className="mt-0.5 size-4 shrink-0 text-navy dark:text-sky" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CheckPage() {
  const { type } = useParams()
  const mediaType = MEDIA_TYPES[type]
  if (!mediaType) return <Navigate to="/" replace />
  const Icon = mediaType.icon

  return (
    <div className="space-y-6">
      <section className="floating-panel relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-deep to-navy p-6 text-white sm:p-8">
        <div className="absolute -right-10 -bottom-16 size-56 rounded-full bg-sky/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-14 animate-float place-items-center rounded-2xl bg-white text-navy shadow-lg">
              <Icon className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{mediaType.label}</h1>
              <p className="text-white/75">{mediaType.tagline}</p>
            </div>
          </div>
          {/* Switch between checkers without going back to the dashboard */}
          <div className="flex gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
            {MEDIA_TYPE_LIST.map((m) => (
              <Link
                key={m.key}
                to={`/check/${m.key}`}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all',
                  m.key === mediaType.key ? 'bg-white font-medium text-navy shadow' : 'text-white/75 hover:bg-white/10 hover:text-white',
                )}
              >
                <m.icon className="size-4" />
                {m.label.replace(' check', '')}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {/* key resets the dropzone state when switching between checkers */}
          <MediaDropzone key={mediaType.key} mediaType={mediaType} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-navy dark:text-sky" />
            Files are deleted from the server after scanning. Only the SHA-256 hash and results are kept.
          </p>
        </div>

        <div className="space-y-4">
          <InfoPanel title="What this check does" icon={CheckCircle2} items={mediaType.checks} delay={80} />
          <InfoPanel title="What it looks for" icon={Target} items={mediaType.detects} delay={200} />
          <p className="animate-rise rounded-2xl bg-secondary p-4 text-xs text-secondary-foreground [animation-delay:400ms]">
            You get a risk level, separate risk metrics and the most likely kind of manipulation, not just a
            &ldquo;fake&rdquo; or &ldquo;AI&rdquo; label.
          </p>
        </div>
      </div>
    </div>
  )
}
