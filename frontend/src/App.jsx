import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Moon, ScanFace, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHealth } from '@/lib/api'
import { MEDIA_TYPE_LIST } from '@/lib/mediaTypes'
import DashboardPage from '@/pages/DashboardPage'
import CheckPage from '@/pages/CheckPage'
import ScanPage from '@/pages/ScanPage'
import HistoryPage from '@/pages/HistoryPage'

// Defaults to the light (white + navy) theme; the toggle remembers the choice.
function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark'
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      // storage unavailable
    }
  }, [dark])
  return [dark, setDark]
}

function StatusDot() {
  const [health, setHealth] = useState(null)
  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ status: 'down' }))
  }, [])
  if (!health) return null
  const ok = health.status === 'ok' && health.db === 'connected'
  const text = health.status !== 'ok' ? 'API offline' : health.db !== 'connected' ? 'Database offline' : `Detector: ${health.detector}`
  return (
    <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 lg:flex">
      <span className="relative flex size-2">
        {ok && <span className="absolute inline-flex size-full animate-ping rounded-full bg-authentic opacity-75" />}
        <span className={cn('relative inline-flex size-2 rounded-full', ok ? 'bg-authentic' : 'bg-manipulated')} />
      </span>
      {text}
    </span>
  )
}

const navClass = ({ isActive }) =>
  cn(
    'relative shrink-0 rounded-lg px-3 py-1.5 text-sm transition-all duration-200',
    isActive ? 'bg-white font-medium text-navy shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white',
  )

export default function App() {
  const [dark, setDark] = useTheme()
  const location = useLocation()

  return (
    <div className="relative isolate min-h-svh text-foreground">
      <div aria-hidden="true" className="page-grid pointer-events-none fixed inset-0 -z-10" />
      <header className="sticky top-0 z-40 bg-navy-deep/95 text-white shadow-lg shadow-navy-deep/20 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4">
          <NavLink to="/" className="group flex shrink-0 items-center gap-2.5 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-white text-navy transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
              <ScanFace className="size-5" />
            </span>
            <span className="hidden tracking-tight md:inline">
              Deepfake<span className="text-sky">Screener</span>
            </span>
          </NavLink>
          <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            <NavLink to="/" end className={navClass}>Dashboard</NavLink>
            {MEDIA_TYPE_LIST.map((m) => (
              <NavLink key={m.key} to={`/check/${m.key}`} className={navClass}>
                <span className="flex items-center gap-1.5"><m.icon className="size-4" />{m.label.replace(' check', '')}</span>
              </NavLink>
            ))}
            <NavLink to="/history" className={navClass}>History</NavLink>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <StatusDot />
            <button
              type="button"
              onClick={() => setDark(!dark)}
              aria-label="Toggle theme"
              className="grid size-9 place-items-center rounded-lg text-white/80 transition-all hover:rotate-12 hover:bg-white/10 hover:text-white"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* key restarts the entrance animation on every route change */}
      <main key={location.pathname} className="mx-auto max-w-6xl animate-rise px-4 py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/check/:type" element={<CheckPage />} />
          <Route path="/scans/:id" element={<ScanPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Automated screening can be wrong in both directions. Treat results as one piece of evidence and verify through a trusted channel.
      </footer>
    </div>
  )
}
