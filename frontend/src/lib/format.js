export const BANDS = {
  likely_authentic: { label: 'Likely authentic', color: 'var(--authentic)', className: 'bg-authentic/15 text-authentic' },
  inconclusive: { label: 'Inconclusive', color: 'var(--inconclusive)', className: 'bg-inconclusive/15 text-inconclusive' },
  likely_manipulated: { label: 'Likely manipulated', color: 'var(--manipulated)', className: 'bg-manipulated/15 text-manipulated' },
}

export const RISK_LEVELS = {
  low: { label: 'Low risk', color: 'var(--authentic)', className: 'bg-authentic/15 text-authentic' },
  medium: { label: 'Medium risk', color: 'var(--inconclusive)', className: 'bg-inconclusive/15 text-inconclusive' },
  high: { label: 'High risk', color: 'var(--manipulated)', className: 'bg-manipulated/15 text-manipulated' },
  critical: { label: 'Critical risk', color: 'var(--manipulated)', className: 'bg-manipulated text-white' },
}

export const pct =(x, digits = 0) => (typeof x === 'number' ? `${(x * 100).toFixed(digits)}%` : '—')

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

export function formatSeconds(s) {
  if (typeof s !== 'number') return '—'
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

export const formatDate = (iso) => new Date(iso).toLocaleString()
