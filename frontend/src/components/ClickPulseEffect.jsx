import { useEffect, useState } from 'react'

export default function ClickPulseEffect() {
  const [pulses, setPulses] = useState([])

  useEffect(() => {
    function handleClick(e) {
      // Don't trigger if right click
      if (e.button && e.button !== 0) return

      const id = Date.now() + Math.random()
      const x = e.clientX
      const y = e.clientY

      const newPulse = { id, x, y }

      setPulses((prev) => [...prev.slice(-12), newPulse])

      setTimeout(() => {
        setPulses((prev) => prev.filter((p) => p.id !== id))
      }, 750)
    }

    window.addEventListener('pointerdown', handleClick, { passive: true })
    return () => window.removeEventListener('pointerdown', handleClick)
  }, [])

  return (
    <div className="click-effects-layer" aria-hidden="true">
      {pulses.map((pulse) => (
        <div
          key={pulse.id}
          className="click-pulse-origin"
          style={{ left: `${pulse.x}px`, top: `${pulse.y}px` }}
        >
          <div className="click-shockwave primary" />
          <div className="click-shockwave secondary" />
          <div className="click-core" />
          <span className="click-particle p1" />
          <span className="click-particle p2" />
          <span className="click-particle p3" />
          <span className="click-particle p4" />
          <span className="click-particle p5" />
          <span className="click-particle p6" />
        </div>
      ))}
    </div>
  )
}
