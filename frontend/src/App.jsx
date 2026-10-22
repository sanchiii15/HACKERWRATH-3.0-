import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import { HistoryPage, ReportPage } from './pages/History'
import Methodology from './pages/Methodology'
import ClickPulseEffect from './components/ClickPulseEffect'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <ClickPulseEffect />
        <header className="nav">
          <Link to="/" className="brand" aria-label="SurfaceCheck home">
            <span className="brand-mark">S</span>
            <span className="brand-name">Surface<span>Check</span></span>
          </Link>

          <nav className="nav-links" aria-label="Primary navigation">
            <NavLink to="/dashboard">Analyze</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/methodology">Methodology</NavLink>
          </nav>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:id" element={<ReportPage />} />
            <Route path="/methodology" element={<Methodology />} />
          </Routes>
        </main>

        <footer className="footer">
          <div className="footer-inner">
            <span>SurfaceCheck</span>
            <span className="footer-divider">•</span>
            <span>Automated screening can produce false positives and false negatives. Use results alongside other evidence.</span>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}
