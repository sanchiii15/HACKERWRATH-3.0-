import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { FileAudio, FileImage, FileVideo, Loader2, ShieldCheck, Upload } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { uploadScan } from '@/lib/api'
import { rememberMedia } from '@/lib/mediaStore'
import { formatBytes } from '@/lib/format'

const MAX_MB = 200

const STEPS = [
  { icon: FileVideo, title: 'Video', text: 'Full clip plus sampled frames, scored on the original and on re-encoded copies' },
  { icon: FileImage, title: 'Image', text: 'Scored before and after JPEG compression and resizing' },
  { icon: FileAudio, title: 'Voice', text: 'Checked for cloning, including phone-quality and VoIP-style versions' },
]

export default function UploadPage() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const uploading = progress !== null

  async function handleFile(file) {
    setError(null)
    setProgress(0)
    try {
      const { scan } = await uploadScan(file, { onProgress: setProgress })
      rememberMedia(scan._id, file)
      navigate(`/scans/${scan._id}`)
    } catch (err) {
      setError(err.message)
      setProgress(null)
    }
  }

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: { 'video/*': [], 'image/*': [], 'audio/*': [] },
    maxFiles: 1,
    maxSize: MAX_MB * 1024 * 1024,
    disabled: uploading,
    onDropAccepted: ([file]) => handleFile(file),
    onDropRejected: ([rejection]) => setError(rejection.errors[0]?.message ?? 'File rejected'),
  })

  const file = acceptedFiles[0]

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Screen suspicious media</h1>
        <p className="text-muted-foreground">
          Upload a video, image, or voice note. You get a confidence range, not a bare &ldquo;fake&rdquo; label,
          tested against the compression and resizing that uploads go through.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors',
          isDragActive ? 'border-primary bg-muted' : 'border-border hover:bg-muted/50',
          uploading && 'cursor-default opacity-80',
        )}
      >
        <input {...getInputProps()} />
        {uploading ? <Loader2 className="size-10 animate-spin text-muted-foreground" /> : <Upload className="size-10 text-muted-foreground" />}
        {uploading && file ? (
          <div className="w-full max-w-sm space-y-2">
            <p className="text-sm font-medium">{file.name} · {formatBytes(file.size)}</p>
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">{progress < 100 ? `Uploading ${progress}%` : 'Starting analysis…'}</p>
          </div>
        ) : (
          <>
            <p className="font-medium">{isDragActive ? 'Drop to scan' : 'Drag a file here, or click to browse'}</p>
            <p className="text-sm text-muted-foreground">Video, image or audio, up to {MAX_MB} MB</p>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <Card key={title} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Icon className="size-4" />{title}</CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" />
        Files are deleted from the server after scanning. Only the SHA-256 hash and results are kept.
      </p>
    </div>
  )
}
