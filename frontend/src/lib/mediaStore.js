// The backend deletes uploads after scanning, so playback uses the local File.
// Object URLs live for this browser session only; a refreshed page has no media.
const urls = new Map()

export function rememberMedia(scanId, file) {
  if (urls.has(scanId)) URL.revokeObjectURL(urls.get(scanId).url)
  urls.set(scanId, { url: URL.createObjectURL(file), type: file.type })
}

export function getMedia(scanId) {
  return urls.get(scanId) ?? null
}
