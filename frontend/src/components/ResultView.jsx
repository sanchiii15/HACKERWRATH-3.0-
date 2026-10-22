import { Link } from 'react-router-dom'
import { downloadReport } from '../lib/reportExport'

const ASSESS = {
  lower: 'Lower indication of manipulation',
  inconclusive: 'Inconclusive',
  elevated: 'Elevated indication of manipulation',
}
const BAND = { low: 'Low', moderate: 'Moderate', high: 'High' }
const FLAG = { ok: 'No concern', mixed: 'Unclear', concern: 'Flagged' }
const FACTORS = [
  ['Video compression', 'Heavy re-encoding can hide or imitate manipulation traces.'],
  ['Resolution changes', 'Resizing can remove fine detail that detectors rely on.'],
  ['Noise', 'Added noise can lower scores for manipulated media or raise them for genuine media.'],
  ['Frame-rate changes', 'Dropped or interpolated frames affect timing checks.'],
  ['Audio compression', 'Phone and messaging codecs alter voice characteristics.'],
]

export default function ResultView({ result, onReset }) {
  const demo = result.analysisMode === 'demo'
  const rob = result.robustness
  return (
    <div className="stack">
      {demo && (
        <div className="notice">
          Demo mode: this result is simulated from mock data. It is not a real detection result, and the score is not a probability.
        </div>
      )}

      <section className={'card assess ' + result.assessment}>
        <h2>{ASSESS[result.assessment]}</h2>
        <p className="muted">
          {demo ? 'Illustrative score' : 'Model score'}: {result.score}/100 · Confidence band: {BAND[result.confidenceBand]}
        </p>
        <div className="meter" aria-label={`Score ${result.score} out of 100`}>
          <div className="marker" style={{ left: result.score + '%' }} />
        </div>
        <div className="meter-labels"><span>Lower</span><span>Inconclusive</span><span>Elevated</span></div>
        <p className="muted small">A score of {result.score}/100 does not mean a {result.score}% chance the media is fake.</p>
      </section>

      <section>
        <h3>Evidence summary{demo && ' (simulated)'}</h3>
        <div className="grid">
          {result.evidence.map((e) => (
            <div className="card" key={e.label}>
              <span className={'tag ' + e.flag}>{FLAG[e.flag] || e.flag}</span>
              <h4>{e.label}</h4>
              <p className="muted">{e.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Robustness</h3>
        {rob?.original && rob?.afterCompression ? (
          <>
            <p className="muted">{rob.afterCompression.method}{rob.simulated && ' (simulated, not actually tested)'}</p>
            {[['Original file', rob.original.score], ['After compression', rob.afterCompression.score]].map(([label, s]) => (
              <div className="bar-row" key={label}>
                <span>{label}</span>
                <div className="bar"><div style={{ width: s + '%' }} /></div>
                <span>{s}</span>
              </div>
            ))}
            <p className="muted small">If the two scores differ a lot, the detector is sensitive to compression and the result needs extra care.</p>
          </>
        ) : (
          <p className="muted">This analysis did not include robustness test results.</p>
        )}
        <h4>What can affect reliability</h4>
        <ul className="plain">
          {FACTORS.map(([t, d]) => <li key={t}><strong>{t}.</strong> {d}</li>)}
        </ul>
      </section>

      <section className="card">
        <h3>Analysis details</h3>
        <dl className="meta">
          <dt>Media type</dt><dd>{result.mediaType}</dd>
          <dt>File name</dt><dd>{result.fileName}</dd>
          <dt>Status</dt><dd>{result.status}</dd>
          <dt>Time</dt><dd>{new Date(result.createdAt).toLocaleString()}</dd>
          <dt>Detector version</dt><dd>{result.detectorVersion || 'Not provided'}</dd>
          <dt>Mode</dt><dd>{demo ? 'Demo' : 'Live'}</dd>
        </dl>
      </section>

      <div className="actions">
        {onReset && <button className="btn" onClick={onReset}>Analyze another file</button>}
        <Link className="btn ghost" to={'/history/' + result.id}>View detailed report</Link>
        <button className="btn ghost" onClick={() => downloadReport(result)}>Download report (JSON)</button>
      </div>
    </div>
  )
}
