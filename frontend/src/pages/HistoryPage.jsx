import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { deleteScan, listScans } from '@/lib/api'
import { BANDS, formatBytes, formatDate, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

function Verdict({ scan }) {
  if (scan.status !== 'complete') {
    return <span className={cn('text-xs capitalize', scan.status === 'failed' ? 'text-manipulated' : 'text-muted-foreground')}>{scan.status}</span>
  }
  const band = BANDS[scan.confidence.band]
  return <span className={cn('rounded px-2 py-0.5 text-xs font-medium', band.className)}>{band.label}</span>
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    listScans({ page, limit: PAGE_SIZE }).then(setData).catch((e) => setError(e.message))
  }, [page])

  useEffect(load, [load])

  async function remove(e, id) {
    e.stopPropagation()
    if (!window.confirm('Delete this scan record?')) return
    try {
      await deleteScan(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!data) return <Skeleton className="h-64 w-full" />

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Scan history</h1>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scans yet. <Link to="/" className="underline">Upload a file</Link> to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Scanned</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((s) => (
              <TableRow key={s._id} className="cursor-pointer" onClick={() => navigate(`/scans/${s._id}`)}>
                <TableCell className="max-w-64 truncate font-medium">
                  {s.originalName}
                  <span className="ml-2 text-xs text-muted-foreground">{formatBytes(s.size)}</span>
                </TableCell>
                <TableCell className="capitalize">{s.mediaType}</TableCell>
                <TableCell><Verdict scan={s} /></TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.confidence ? `${pct(s.confidence.score)} ±${pct(s.confidence.margin)}` : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon-sm" variant="ghost" aria-label="Delete scan" onClick={(e) => remove(e, s._id)}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
