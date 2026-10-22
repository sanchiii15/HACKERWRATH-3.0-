import { Link } from 'react-router-dom'

const FEATURES = [
  ['Video forensics', 'Checks sampled frames for visual and timing inconsistencies.'],
  ['Image analysis', 'Screens a single image for signs of generation or editing.'],
  ['Voice analysis', 'Screens a recording for signs of synthetic or cloned speech.'],
]
const BANDS = [
  ['Lower indication', 'Few irregular signals were found.', 'ok'],
  ['Inconclusive', 'Signals conflict or are too weak to rely on.', 'mixed'],
  ['Elevated indication', 'Several irregular signals were found. Verify the source.', 'concern'],
]

export default function Landing() {
  return (
    <div className="page">
      <section className="hero">
        <h1>Look Beyond the Surface.</h1>
        <p className="lead">Screen suspicious video, image, and audio content with uncertainty-aware analysis and evidence-driven reporting.</p>
        <Link className="btn" to="/dashboard">Analyze media</Link>
      </section>

      <section className="grid">
        {FEATURES.map(([t, d]) => (
          <div className="card" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>
        ))}
      </section>

      <section>
        <h2>Results come as confidence bands</h2>
        <p className="muted">We never show a bare Fake or Real. Every result includes a band, the evidence behind it, and its limits.</p>
        <div className="grid">
          {BANDS.map(([t, d, f]) => (
            <div className="card" key={t}><span className={'tag ' + f}>{t}</span><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Tested against real-world degradation</h2>
        <p className="muted">Uploads are usually compressed, resized and re-encoded. A detector that works on the original file can fail after that. Reports show how results change after compression, so you can see how fragile a result is.</p>
      </section>

      <section className="notice">
        Automated detection can produce false positives and false negatives. Use results as one input, together with other evidence.
      </section>
    </div>
  )
}
