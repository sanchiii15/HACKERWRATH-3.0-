import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Moon, ScanFace, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getHealth } from '@/lib/api'
import UploadPage from '@/pages/UploadPage'
import ScanPage from '@/pages/ScanPage'
import HistoryPage from '@/pages/HistoryPage'

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
    } catch {
      // storage unavailable
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
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
    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
      <span className={cn('size-2 rounded-full', ok ? 'bg-authentic' : 'bg-manipulated')} />
      {text}
    </span>
  )
}

const navClass = ({ isActive }) =>
  cn('rounded-md px-3 py-1.5 text-sm transition-colors', isActive ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')

export default function App() {
  const [dark, setDark] = useTheme()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <ScanFace className="size-5" />
            Deepfake Screener
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>Scan</NavLink>
            <NavLink to="/history" className={navClass}>History</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <StatusDot />
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/scans/:id" element={<ScanPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  )
}
