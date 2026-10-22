import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatSeconds, pct } from '@/lib/format'

export default function AnomalyList({ anomalies, onSeek }) {
  if (!anomalies?.length) {
    return <p className="text-sm text-muted-foreground">No segments were flagged above the threshold.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {anomalies.map((a, i) => (
          <TableRow key={i} className={onSeek ? 'cursor-pointer' : undefined} onClick={() => onSeek?.(a.start)}>
            <TableCell className="font-mono tabular-nums">{formatSeconds(a.start)}–{formatSeconds(a.end)}</TableCell>
            <TableCell className="capitalize">{a.source}</TableCell>
            <TableCell className="text-muted-foreground">{a.label ?? '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{pct(a.score, 1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
