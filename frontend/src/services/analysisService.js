// The ONLY file the UI uses to get results.
// No VITE_API_BASE_URL  -> Demo mode (mock data).
// VITE_API_BASE_URL set -> Live mode, calls POST {BASE}/analyze/{video|image|audio}
const BASE = import.meta.env.VITE_API_BASE_URL
const KEY = 'smd_history'

const LEVELS = [
  { assessment: 'lower', score: 21, confidenceBand: 'moderate', flag: 'ok' },
  { assessment: 'inconclusive', score: 48, confidenceBand: 'low', flag: 'mixed' },
  { assessment: 'elevated', score: 78, confidenceBand: 'moderate', flag: 'concern' },
]
const LABELS = {
  video: ['Visual consistency', 'Temporal consistency', 'Compression sensitivity', 'Media quality'],
  image: ['Visual consistency', 'Texture patterns', 'Compression sensitivity', 'Media quality'],
  audio: ['Audio characteristics', 'Speech rhythm', 'Compression sensitivity', 'Media quality'],
}
const DETAIL = {
  ok: 'No notable irregularities in this simulated check.',
  mixed: 'Some signals are unclear in this simulated check.',
  concern: 'Irregular patterns appear in this simulated check.',
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// Same file name always gives the same demo result.
async function mockAnalyze(file, mediaType) {
  await wait(1800)
  const pick = [...file.name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3
  const lv = LEVELS[pick]
  return {
    id: 'demo-' + Date.now(),
    mediaType,
    fileName: file.name,
    status: 'complete',
    assessment: lv.assessment,
    score: lv.score,
    confidenceBand: lv.confidenceBand,
    evidence: LABELS[mediaType].map((label, i) => ({
      label,
      flag: i === 3 ? 'ok' : lv.flag,
      detail: DETAIL[i === 3 ? 'ok' : lv.flag],
    })),
    robustness: {
      simulated: true,
      original: { score: lv.score },
      afterCompression: { score: Math.max(5, lv.score - 18), method: 'Simulated low-bitrate re-encode and 50% resize' },
    },
    detectorVersion: 'demo-0.0',
    analysisMode: 'demo',
    createdAt: new Date().toISOString(),
  }
}

export async function analyzeMedia(file, mediaType) {
  if (!BASE) return mockAnalyze(file, mediaType)
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/analyze/${mediaType}`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`The analysis service returned an error (${res.status}). Try again.`)
  const data = await res.json()
  return { ...data, analysisMode: 'live' }
}

export function getAnalysisHistory() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
export function saveToHistory(result) {
  localStorage.setItem(KEY, JSON.stringify([result, ...getAnalysisHistory()].slice(0, 50)))
}
export function getAnalysisById(id) {
  return getAnalysisHistory().find((r) => r.id === id)
}
export function clearHistory() { localStorage.removeItem(KEY) }
