import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { uploadScan } from '@/lib/api'
import { rememberMedia } from '@/lib/mediaStore'
import { formatBytes } from '@/lib/format'

const MAX_MB = 200

// Upload box for one media type; opens the scan page once the backend accepts the file.
export default function MediaDropzone({ mediaType }) {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const uploading = progress !== null

  async function handleFile(f) {
    setFile(f)
    setError(null)
    setProgress(0)
    try {
      const { scan } = await uploadScan(f, { onProgress: setProgress })
      rememberMedia(scan._id, f)
      navigate(`/scans/${scan._id}`)
    } catch (err) {
      setError(err.message)
      setProgress(null)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaType.accept,
    maxFiles: 1,
    maxSize: MAX_MB * 1024 * 1024,
    disabled: uploading,
    onDropAccepted: ([f]) => handleFile(f),
    onDropRejected: ([rejection]) =>
      setError(
        rejection.errors[0]?.code === 'file-invalid-type'
          ? `That isn't a supported ${mediaType.noun} file. Use ${mediaType.formats}.`
          : rejection.errors[0]?.message ?? 'File rejected',
      ),
  })

  const Icon = mediaType.icon

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'group relative flex min-h-72 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed bg-card p-10 text-center transition-all duration-300',
          isDragActive
            ? 'scale-[1.01] border-navy bg-accent shadow-xl shadow-navy/10 dark:border-sky'
            : 'border-navy/25 hover:border-navy/60 hover:bg-accent/50 hover:shadow-lg hover:shadow-navy/5 dark:border-white/20 dark:hover:border-sky/60',
          uploading && 'scan-beam cursor-default border-solid border-navy dark:border-sky',
        )}
      >
        <input {...getInputProps()} />

        <div className="relative">
          {(isDragActive || uploading) && (
            <>
              <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-navy/30 dark:bg-sky/30" />
              <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-navy/20 [animation-delay:1.2s] dark:bg-sky/20" />
            </>
          )}
          <span
            className={cn(
              'relative grid size-20 place-items-center rounded-2xl bg-navy text-white shadow-lg shadow-navy/25 transition-transform duration-300 dark:bg-white dark:text-navy',
              uploading ? 'animate-float' : 'group-hover:-translate-y-1 group-hover:scale-105',
            )}
          >
            <Icon className="size-9" />
            <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full bg-sky text-navy-deep ring-4 ring-card">
              <Upload className="size-4" />
            </span>
          </span>
        </div>

        {uploading && file ? (
          <div className="relative w-full max-w-sm space-y-3">
            <p className="truncate text-sm font-medium">{file.name} · {formatBytes(file.size)}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-navy to-sky transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              >
                <span className="animate-shimmer absolute inset-0" />
              </div>
            </div>
            <p className="text-xs font-medium text-navy dark:text-sky">
              {progress < 100 ? `Uploading ${progress}%` : 'Upload complete, starting analysis…'}
            </p>
          </div>
        ) : (
          <div className="relative space-y-1">
            <p className="text-lg font-semibold">
              {isDragActive ? 'Release to start the check' : <>Drop a {mediaType.noun} file here or <span className="text-navy underline decoration-sky decoration-2 underline-offset-4 dark:text-sky">browse</span></>}
            </p>
            <p className="text-sm text-muted-foreground">{mediaType.formats} · up to {MAX_MB} MB</p>
          </div>
        )}
      </div>
      {error && (
        <Alert variant="destructive" className="animate-rise">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
