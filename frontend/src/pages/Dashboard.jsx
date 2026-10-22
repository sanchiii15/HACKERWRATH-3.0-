import { useEffect, useState } from 'react'
import UploadZone from '../components/UploadZone'
import ResultView from '../components/ResultView'
import { analyzeMedia, saveToHistory } from '../services/analysisService'
import { validateFile } from '../lib/fileValidation'

const TYPES = ['video', 'image', 'audio']

export default function Dashboard() {
  const [type, setType] = useState('video')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  // Free the preview URL when it is replaced or the page closes
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function pick(f) {
    const problem = validateFile(f, type)
    if (problem) return setError(problem)
    setError('')
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }
  function reset() { setFile(null); setPreviewUrl(null); setError(''); setResult(null) }
  function changeType(t) { setType(t); reset() }

  async function run() {
    setLoading(true)
    setError('')
    try {
      const r = await analyzeMedia(file, type)
      saveToHistory(r)
      setResult(r)
    } catch (e) {
      setError(e.message || 'Analysis failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard-bg">
      <div className="page narrow">
      <div className="page-header">
        <h1>Analyze media</h1>
        <p className="lead">Upload suspicious media to perform forensic signal screening and compression robustness testing.</p>
      </div>
      {result ? (
        <ResultView result={result} onReset={reset} />
      ) : (
        <div className="stack">
          <div className="tabs" role="tablist">
            {TYPES.map((t) => (
              <button key={t} role="tab" aria-selected={t === type} className={t === type ? 'active' : ''} onClick={() => changeType(t)} disabled={loading}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <UploadZone type={type} file={file} previewUrl={previewUrl} onPick={pick} onClear={reset} disabled={loading} />
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn" onClick={run} disabled={!file || loading}>
            {loading ? (
              <>
                <span className="cyber-spinner" />
                <span>Running analysis…</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Analyze media</span>
              </>
            )}
          </button>
          {loading && <p className="muted">Running forensic checks. This can take a moment.</p>}
          <p className="muted small">Demo mode is on unless an API address is set. Demo results are simulated.</p>
        </div>
      )}
      </div>
    </div>
  )
}
