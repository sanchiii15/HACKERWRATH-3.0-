const MB = 1024 * 1024

export const RULES = {
  video: { types: ['video/mp4', 'video/quicktime', 'video/webm'], max: 100 * MB, label: 'MP4, MOV or WebM, up to 100 MB' },
  image: { types: ['image/jpeg', 'image/png', 'image/webp'], max: 10 * MB, label: 'JPG, PNG or WebP, up to 10 MB' },
  audio: { types: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm', 'audio/ogg'], max: 25 * MB, label: 'MP3, WAV, M4A, OGG or WebM, up to 25 MB' },
}

// Returns an error message, or '' if the file is fine.
// This only helps the user. The backend must validate again.
export function validateFile(file, mediaType) {
  const rule = RULES[mediaType]
  if (!rule.types.includes(file.type)) return `This file type is not supported for ${mediaType}. Use ${rule.label}.`
  if (file.size > rule.max) return `This file is too large. Use ${rule.label}.`
  return ''
}

export function formatSize(bytes) {
  return bytes > MB ? (bytes / MB).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'
}
