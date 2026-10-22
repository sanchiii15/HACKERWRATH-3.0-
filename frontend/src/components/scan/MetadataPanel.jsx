import { useState } from 'react'
import { Camera, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { formatBytes, formatSeconds } from '@/lib/format'

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <TableRow>
      <TableCell className="w-48 text-muted-foreground">{label}</TableCell>
      <TableCell className="font-mono text-xs break-all whitespace-normal">{String(value)}</TableCell>
    </TableRow>
  )
}

export default function MetadataPanel({ scan }) {
  const [showAll, setShowAll] = useState(false)
  const m = scan.metadata ?? {}
  const exifEntries = Object.entries(m.exif ?? {})

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {m.generatorTags?.length ? (
          <Badge variant="destructive"><Sparkles /> AI generator traces found</Badge>
        ) : (
          <Badge variant="secondary">No generator tags</Badge>
        )}
        {m.hasCameraExif ? <Badge variant="outline"><Camera /> Camera EXIF present</Badge> : <Badge variant="outline">No camera EXIF</Badge>}
      </div>

      {m.generatorTags?.length > 0 && (
        <Table>
          <TableBody>
            {m.generatorTags.map((t) => <Row key={t.tag} label={t.tag} value={t.value} />)}
          </TableBody>
        </Table>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">File</h3>
        <Table>
          <TableBody>
            <Row label="Name" value={scan.originalName} />
            <Row label="Type" value={scan.mimeType} />
            <Row label="Size" value={formatBytes(scan.size)} />
            <Row label="SHA-256" value={scan.sha256} />
            <Row label="Container" value={m.container} />
            <Row label="Duration" value={m.duration && formatSeconds(m.duration)} />
            <Row label="Resolution" value={m.width && `${m.width} × ${m.height}`} />
            <Row label="Frame rate" value={m.fps && `${m.fps} fps`} />
            <Row label="Video codec" value={m.videoCodec} />
            <Row label="Audio codec" value={m.audioCodec} />
            <Row label="Bitrate" value={m.bitrate && `${Math.round(m.bitrate / 1000)} kb/s`} />
          </TableBody>
        </Table>
      </div>

      {exifEntries.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">All metadata tags ({exifEntries.length})</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Hide' : 'Show'}</Button>
          </div>
          {showAll && (
            <Table>
              <TableBody>
                {exifEntries.map(([k, v]) => <Row key={k} label={k} value={v} />)}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}
