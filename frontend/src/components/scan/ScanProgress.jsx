import { Check, Loader2 } from 'lucide-react'
import ScannerGraphic from '@/components/ScannerGraphic'
import { cn } from '@/lib/utils'

// Pipeline steps per media type; `match` is the start of the backend's `stage` text.
const STEPS = {
  video: [
    { match: 'Queued', label: 'Queued' },
    { match: 'Reading metadata', label: 'Reading metadata and EXIF' },
    { match: 'Running forensic', label: 'Forensic checks: spectrum, frame timing, scene cuts, audio' },
    { match: 'Stress-testing', label: 'Re-encoding copies for stress tests' },
    { match: 'Running video', label: 'Running video detector' },
    { match: 'Scanning sampled frames', label: 'Scanning sampled frames' },
    { match: 'Running voice', label: 'Checking the soundtrack for voice cloning' },
  ],
  image: [
    { match: 'Queued', label: 'Queued' },
    { match: 'Reading metadata', label: 'Reading metadata and AI generator tags' },
    { match: 'Running forensic', label: 'Forensic checks: error levels, frequency spectrum, duplicates' },
    { match: 'Stress-testing', label: 'Compressing and resizing copies' },
    { match: 'Running image', label: 'Running image detector' },
  ],
  audio: [
    { match: 'Queued', label: 'Queued' },
    { match: 'Reading metadata', label: 'Reading metadata' },
    { match: 'Running forensic', label: 'Forensic checks: bandwidth, digital silence, clipping' },
    { match: 'Running voice', label: 'Running voice detector on original and phone/VoIP copies' },
  ],
}

export default function ScanProgress({ scan }) {
  const steps = STEPS[scan.mediaType] ?? STEPS.video
  const found = steps.findIndex((s) => scan.stage?.startsWith(s.match))
  const current = Math.max(0, found)
  const percent = Math.round(((current + 0.5) / steps.length) * 100)

  return (
    <section className="floating-panel relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-deep via-navy to-navy-deep p-6 text-white sm:p-8">
      <div className="relative grid items-center gap-8 md:grid-cols-[200px_1fr]">
        <ScannerGraphic className="mx-auto w-40 md:w-full" />
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Analysing your {scan.mediaType}…</h2>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-sky to-white transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              >
                <span className="animate-shimmer absolute inset-0" />
              </div>
            </div>
          </div>
          <ol className="space-y-2.5">
            {steps.map((s, i) => {
              const done = i < current
              const active = i === current
              return (
                <li key={s.match} className={cn('flex items-center gap-3 text-sm transition-opacity', !done && !active && 'opacity-45')}>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full ring-1',
                      done && 'bg-sky text-navy-deep ring-sky',
                      active && 'bg-white text-navy ring-white',
                      !done && !active && 'ring-white/30',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-[10px]">{i + 1}</span>}
                  </span>
                  <span className={active ? 'font-medium' : undefined}>{s.label}</span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
