import { useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScan } from '@/hooks/useScan'
import { getMedia } from '@/lib/mediaStore'
import { formatBytes, formatDate } from '@/lib/format'
import ConfidenceCard from '@/components/scan/ConfidenceCard'
import RiskSummary from '@/components/scan/RiskSummary'
import ManipulationTypes from '@/components/scan/ManipulationTypes'
import RobustnessChart from '@/components/scan/RobustnessChart'
import FrameTimelineChart from '@/components/scan/FrameTimelineChart'
import MediaWaveform from '@/components/scan/MediaWaveform'
import AnomalyList from '@/components/scan/AnomalyList'
import MetadataPanel from '@/components/scan/MetadataPanel'
import ScanProgress from '@/components/scan/ScanProgress'
import ForensicsPanel from '@/components/scan/ForensicsPanel'
import FeedbackBox from '@/components/scan/FeedbackBox'
import { reportUrl } from '@/lib/api'

export default function ScanPage() {
  const { id } = useParams()
  const { scan, error } = useScan(id)
  const playerRef = useRef(null)
  const media = getMedia(id)
  const seek = media ? (t) => playerRef.current?.seek(t) : undefined

  // Stable reference so the waveform isn't rebuilt on every poll.
  const anomalyKey = JSON.stringify(scan?.anomalies ?? [])
  const anomalies = useMemo(() => JSON.parse(anomalyKey), [anomalyKey])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load scan</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  if (!scan) return <Skeleton className="h-64 w-full" />

  const done = scan.status === 'complete'
  const playable = media && (scan.mediaType === 'video' || scan.mediaType === 'audio')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <Link to={`/check/${scan.mediaType}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Check another {scan.mediaType} file
        </Link>
        <h1 className="text-xl font-semibold break-all">{scan.originalName}</h1>
        <p className="text-sm text-muted-foreground">
          {scan.mediaType} · {formatBytes(scan.size)} · {formatDate(scan.createdAt)}
          {scan.processingMs && ` · analysed in ${(scan.processingMs / 1000).toFixed(1)}s`}
        </p>
      </div>
        {done && (
          <a
            href={reportUrl(scan._id)}
            download
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-navy/40 hover:shadow-md"
          >
            <Download className="size-4" /> Download report
          </a>
        )}
      </div>

      {scan.status === 'failed' && (
        <Alert variant="destructive">
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{scan.error}</AlertDescription>
        </Alert>
      )}
      {(scan.status === 'queued' || scan.status === 'processing') && <ScanProgress scan={scan} />}

      {done && scan.risk && <RiskSummary risk={scan.risk} confidence={scan.confidence} />}
      {done && (
        <div className="grid animate-rise gap-4 [animation-delay:120ms] lg:grid-cols-[3fr_2fr]">
          <ConfidenceCard confidence={scan.confidence} />
          <ManipulationTypes types={scan.risk?.types} primaryType={scan.risk?.primaryType} />
        </div>
      )}

      {done && (
        <Tabs defaultValue={scan.forensics ? 'forensics' : 'robustness'} className="animate-rise [animation-delay:360ms]">
          <TabsList>
            {scan.forensics && <TabsTrigger value="forensics">Forensics</TabsTrigger>}
            <TabsTrigger value="robustness">Robustness</TabsTrigger>
            {scan.mediaType !== 'image' && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
            {scan.mediaType === 'image' && media && <TabsTrigger value="preview">Preview</TabsTrigger>}
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="forensics" className="pt-4">
            <ForensicsPanel forensics={scan.forensics} />
          </TabsContent>

          <TabsContent value="robustness" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Each detector scored the original upload and copies degraded the way platforms and chat apps degrade media.
              A flat line means the result holds up; a jumpy one widens the confidence range.
            </p>
            <RobustnessChart results={scan.results} margin={scan.confidence.margin} mediaType={scan.mediaType} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4 pt-4">
            {playable ? (
              <MediaWaveform ref={playerRef} url={media.url} kind={scan.mediaType} anomalies={anomalies} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Playback is only available right after uploading. The server doesn&rsquo;t keep your file.
              </p>
            )}
            {scan.mediaType === 'video' && scan.results?.image && (
              <FrameTimelineChart frames={scan.results.image} margin={scan.confidence.margin} onSeek={seek} />
            )}
            <AnomalyList anomalies={anomalies} onSeek={seek} />
          </TabsContent>

          {scan.mediaType === 'image' && media && (
            <TabsContent value="preview" className="pt-4">
              <img src={media.url} alt={scan.originalName} className="max-h-[520px] rounded-lg border object-contain" />
            </TabsContent>
          )}

          <TabsContent value="metadata" className="pt-4">
            <MetadataPanel scan={scan} />
          </TabsContent>
        </Tabs>
      )}

      {done && <FeedbackBox scanId={scan._id} initialCount={scan.feedback?.length ?? 0} />}
    </div>
  )
}
