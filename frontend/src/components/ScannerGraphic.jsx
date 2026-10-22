import { ScanFace } from 'lucide-react'
import { cn } from '@/lib/utils'

// Decorative radar: pulsing rings and a rotating sweep around a face icon.
export default function ScannerGraphic({ className }) {
  return (
    <div className={cn('relative grid aspect-square place-items-center', className)} aria-hidden="true">
      {[0, 0.8, 1.6].map((delay) => (
        <span
          key={delay}
          className="absolute inset-[18%] animate-pulse-ring rounded-full border border-sky/60"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
      <span className="absolute inset-[8%] rounded-full border border-white/15" />
      <span className="absolute inset-[22%] rounded-full border border-white/10" />
      <span
        className="absolute inset-[8%] animate-sweep rounded-full"
        style={{ background: 'conic-gradient(from 0deg, transparent 0deg, color-mix(in oklch, var(--sky) 45%, transparent) 50deg, transparent 60deg)' }}
      />
      <span className="relative grid size-[30%] animate-float place-items-center rounded-2xl bg-white text-navy shadow-2xl shadow-sky/30">
        <ScanFace className="size-1/2" />
      </span>
    </div>
  )
}
