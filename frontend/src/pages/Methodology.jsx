const ITEMS = [
  ['Why screening matters', 'Fake video calls, cloned voices and edited images are used for fraud and misinformation. A quick screen helps decide what to verify further.'],
  ['How the three checks help', 'Video checks look at faces and timing across frames. Image checks look at texture and consistency. Voice checks look at how speech sounds compared with natural speech. Each adds a signal. None is proof alone.'],
  ['Why uncertainty matters', 'A single yes or no hides how unsure a detector can be. Confidence bands show when a result is weak, so people do not over-trust it.'],
  ['Why manipulated media can evade detection', 'Detectors learn the traces of known tools. New tools, compression and re-uploading can remove those traces.'],
  ['What to do next', 'Confirm through another channel, such as calling back on a known number, and check the original source. Treat this tool as one input.'],
]

export default function Methodology() {
  return (
    <div className="page narrow">
      <h1>Methodology</h1>
      <div className="stack">
        {ITEMS.map(([t, d]) => (
          <section className="card" key={t}><h3>{t}</h3><p className="muted">{d}</p></section>
        ))}
      </div>
    </div>
  )
}
