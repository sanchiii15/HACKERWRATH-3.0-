import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatSeconds } from '@/lib/format'

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Translucent fill for a region; canvas understands oklch() in modern browsers.
const withAlpha = (color, alpha) => color.replace(/\)$/, ` / ${alpha})`)

/*
 * Waveform + spectrogram scrubber. For video it drives the <video> element, so the
 * waveform and the picture stay in sync. Flagged anomalies are drawn as regions.
 */
const MediaWaveform = forwardRef(function MediaWaveform({ url, kind, anomalies = [] }, ref) {
  const videoRef = useRef(null)
  const waveRef = useRef(null)
  const specRef = useRef(null)
  const timelineRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useImperativeHandle(ref, () => ({
    seek: (t) => wsRef.current?.setTime(t),
  }))

  useEffect(() => {
    const regions = RegionsPlugin.create()
    const ws = WaveSurfer.create({
      container: waveRef.current,
      height: 72,
      waveColor: cssVar('--muted-foreground'),
      progressColor: cssVar('--primary'),
      cursorColor: cssVar('--foreground'),
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      ...(kind === 'video' ? { media: videoRef.current } : { url }),
      plugins: [
        regions,
        TimelinePlugin.create({ container: timelineRef.current, style: { color: cssVar('--muted-foreground'), fontSize: '11px' } }),
        SpectrogramPlugin.create({ container: specRef.current, height: 96, labels: false, scale: 'mel' }),
      ],
    })
    wsRef.current = ws

    const manipulated = cssVar('--manipulated')
    ws.on('decode', () => {
      regions.clearRegions()
      for (const a of anomalies) {
        regions.addRegion({
          start: a.start,
          end: Math.max(a.end, a.start + 0.2),
          color: withAlpha(manipulated, 0.2 + a.score * 0.25),
          drag: false,
          resize: false,
        })
      }
    })
    ws.on('ready', (d) => setDuration(d))
    ws.on('timeupdate', setTime)
    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    regions.on('region-clicked', (region, e) => {
      e.stopPropagation()
      region.play()
    })

    return () => ws.destroy()
  }, [url, kind, anomalies])

  return (
    <div className="space-y-3">
      {kind === 'video' && (
        <video ref={videoRef} src={url} playsInline className="max-h-[420px] w-full rounded-lg bg-black object-contain" />
      )}
      <div className="rounded-lg border p-3">
        <div ref={waveRef} />
        <div ref={timelineRef} />
        <div ref={specRef} className="mt-2 overflow-hidden rounded" />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => wsRef.current?.playPause()}>
          {playing ? <Pause /> : <Play />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatSeconds(time)} / {formatSeconds(duration)}
        </span>
        {anomalies.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-manipulated/40" /> flagged segment
          </span>
        )}
      </div>
    </div>
  )
})

export default MediaWaveform
