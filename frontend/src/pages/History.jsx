import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import ResultView from '../components/ResultView'
import { getAnalysisHistory, getAnalysisById, clearHistory } from '../services/analysisService'

const ASSESS = { lower: 'Lower indication', inconclusive: 'Inconclusive', elevated: 'Elevated indication' }

export function HistoryPage() {
  const [items, setItems] = useState(getAnalysisHistory())
  return (
    <div className="page">
      <h1>History</h1>
      <p className="muted">Saved in this browser only. This is local demo history, not database storage.</p>
      {items.length === 0 ? (
        <div className="card empty">
          <p>No analyses yet.</p>
          <Link className="btn" to="/dashboard">Analyze a file</Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>File</th><th>Type</th><th>Date</th><th>Assessment</th><th>Mode</th><th></th></tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fileName}</td>
                    <td>{r.mediaType}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>{ASSESS[r.assessment]}</td>
                    <td>{r.analysisMode === 'demo' ? 'Demo' : 'Live'}</td>
                    <td><Link to={'/history/' + r.id}>View details</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn ghost" onClick={() => { clearHistory(); setItems([]) }}>Clear history</button>
        </>
      )}
    </div>
  )
}

export function ReportPage() {
  const { id } = useParams()
  const result = getAnalysisById(id)
  return (
    <div className="page narrow">
      <h1>Report</h1>
      {result ? (
        <ResultView result={result} />
      ) : (
        <div className="card empty">
          <p>This report was not found. It may have been cleared from this browser.</p>
          <Link className="btn" to="/history">Back to history</Link>
        </div>
      )}
    </div>
  )
}
