import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, Moon, ScanFace, Sun, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getHealth } from '@/lib/api'
import { CHECK_LIST } from '@/lib/mediaTypes'
import DashboardPage from '@/pages/DashboardPage'
import CheckPage from '@/pages/CheckPage'
import ScanPage from '@/pages/ScanPage'
import HistoryPage from '@/pages/HistoryPage'
import HowItWorksPage from '@/pages/HowItWorksPage'
import StaySafePage from '@/pages/StaySafePage'
import LiveCallPage from '@/pages/LiveCallPage'
import MessageCheckPage from '@/pages/MessageCheckPage'
import MessageResultPage from '@/pages/MessageResultPage'

// Dark is the default; the toggle switches to light and remembers the choice.
function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
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
  const DETECTOR_TEXT = { onnx: 'AI models: local', remote: 'AI models: remote', stub: 'No AI model (stub)' }
  const text = health.status !== 'ok' ? 'API offline' : health.db !== 'connected' ? 'Database offline' : DETECTOR_TEXT[health.detector] ?? `Detectors: ${health.detector}`
  return (
    <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1 font-mono text-[11px] text-white/60 xl:flex">
      <span className="relative flex size-2">
        {ok && <span className="absolute inline-flex size-full animate-ping rounded-full bg-authentic opacity-75" />}
        <span className={cn('relative inline-flex size-2 rounded-full', ok ? 'bg-authentic' : 'bg-manipulated')} />
      </span>
      {text}
    </span>
  )
}

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/live', label: 'Live call', live: true },
  { to: '/history', label: 'History' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/stay-safe', label: 'Stay safe' },
]

const pillClass = (active) =>
  cn(
    'relative flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-all duration-200',
    active ? 'bg-white/[0.1] font-medium text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
  )

// One "New scan" entry instead of three separate links; the dashboard already shows the checks.
function NewScanMenu() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(pillClass(pathname.startsWith('/check/') || pathname.startsWith('/messages/')), 'outline-none data-[popup-open]:bg-white/15')}>
        New scan <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56">
        {CHECK_LIST.map((m) => (
          <DropdownMenuItem key={m.key} onClick={() => navigate(`/check/${m.key}`)} className="items-start gap-3 py-2">
            <m.icon className="mt-0.5 size-4" />
            <span className="grid gap-0.5">
              <span className="font-medium">{m.label}</span>
              <span className="text-xs text-muted-foreground">{m.formats}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Phone layout: everything in one panel under the header.
function MobileMenu({ onClose }) {
  const linkClass = ({ isActive }) =>
    cn('block rounded-lg px-3 py-2 text-sm', isActive ? 'bg-white/[0.1] font-medium text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white')
  return (
    <nav className="border-t border-white/10 px-4 pt-2 pb-4 md:hidden" aria-label="Mobile">
      <div className="mx-auto grid max-w-6xl gap-1">
        <NavLink to="/" end className={linkClass} onClick={onClose}>Dashboard</NavLink>
        <p className="px-3 pt-2 text-xs font-medium tracking-wide text-white/50 uppercase">New scan</p>
        {CHECK_LIST.map((m) => (
          <NavLink key={m.key} to={`/check/${m.key}`} className={linkClass} onClick={onClose}>
            <span className="flex items-center gap-2"><m.icon className="size-4" />{m.label}</span>
          </NavLink>
        ))}
        <div className="my-1 border-t border-white/10" />
        {LINKS.slice(1).map((l) => (
          <NavLink key={l.to} to={l.to} className={linkClass} onClick={onClose}>{l.label}</NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  const [dark, setDark] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="relative isolate min-h-svh text-foreground">
      <div aria-hidden="true" className="page-grid pointer-events-none fixed inset-0 -z-10" />
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-navy-deep/85 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4">
          <NavLink to="/" className="group flex shrink-0 items-center gap-2.5 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-white text-navy transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
              <ScanFace className="size-5" />
            </span>
            <span className="tracking-tight">
              Deepfake<span className="text-white/55">Screener</span>
            </span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => pillClass(isActive)}>Dashboard</NavLink>
            <NewScanMenu />
            {LINKS.slice(1).map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => pillClass(isActive)}>
                {l.live && <span className="mr-0.5 size-1.5 rounded-full bg-manipulated" aria-hidden="true" />}
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <StatusDot />
            <button
              type="button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="grid size-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="grid size-9 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white md:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
      </header>

      {/* key restarts the entrance animation on every route change */}
      <main key={location.pathname} className="mx-auto max-w-6xl animate-rise px-4 py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/check/message" element={<MessageCheckPage />} />
          <Route path="/check/:type" element={<CheckPage />} />
          <Route path="/messages/:id" element={<MessageResultPage />} />
          <Route path="/scans/:id" element={<ScanPage />} />
          <Route path="/live" element={<LiveCallPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/stay-safe" element={<StaySafePage />} />
        </Routes>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Automated screening can be wrong in both directions. Treat results as one piece of evidence and verify through a trusted channel.
      </footer>
    </div>
  )
}
