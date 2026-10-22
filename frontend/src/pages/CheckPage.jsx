import { Navigate, useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import MediaDropzone from '@/components/MediaDropzone'
import { CheckHeader, CheckInfo } from '@/components/CheckLayout'
import { MEDIA_TYPES } from '@/lib/mediaTypes'

export default function CheckPage() {
  const { type } = useParams()
  const mediaType = MEDIA_TYPES[type]
  if (!mediaType) return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <CheckHeader check={mediaType} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {/* key resets the dropzone state when switching between checkers */}
          <MediaDropzone key={mediaType.key} mediaType={mediaType} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-foreground" />
            Files are deleted from the server after scanning. Only the SHA-256 hash and results are kept.
          </p>
        </div>

        <CheckInfo
          check={mediaType}
          note={<>You get a risk level, the most likely kind of manipulation and how far the result can be trusted, not just a &ldquo;fake&rdquo; or &ldquo;AI&rdquo; label.</>}
        />
      </div>
    </div>
  )
}
