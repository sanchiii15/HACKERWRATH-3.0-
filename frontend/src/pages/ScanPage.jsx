import { useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useScan } from '@/hooks/useScan'
import { getMedia } from '@/lib/mediaStore'
import { formatBytes, formatDate } from '@/lib/format'
import ConfidenceCard from '@/components/scan/ConfidenceCard'
import RobustnessChart from '@/components/scan/RobustnessChart'
import FrameTimelineChart from '@/components/scan/FrameTimelineChart'
import MediaWaveform from '@/components/scan/MediaWaveform'
import AnomalyList from '@/components/scan/AnomalyList'
import MetadataPanel from '@/components/scan/MetadataPanel'

function Processing({ scan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Analysing…
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{scan.stage ?? 'Queued'}</CardContent>
    </Card>
  )
}

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
      <div className="space-y-1">
        <Link to="/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All scans
        </Link>
        <h1 className="text-xl font-semibold break-all">{scan.originalName}</h1>
        <p className="text-sm text-muted-foreground">
          {scan.mediaType} · {formatBytes(scan.size)} · {formatDate(scan.createdAt)}
          {scan.processingMs && ` · analysed in ${(scan.processingMs / 1000).toFixed(1)}s`}
        </p>
      </div>

      {scan.status === 'failed' && (
        <Alert variant="destructive">
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{scan.error}</AlertDescription>
        </Alert>
      )}
      {(scan.status === 'queued' || scan.status === 'processing') && <Processing scan={scan} />}

      {done && <ConfidenceCard confidence={scan.confidence} />}

      {done && (
        <Tabs defaultValue="robustness">
          <TabsList>
            <TabsTrigger value="robustness">Robustness</TabsTrigger>
            {scan.mediaType !== 'image' && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
            {scan.mediaType === 'image' && media && <TabsTrigger value="preview">Preview</TabsTrigger>}
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

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
    </div>
  )
}
