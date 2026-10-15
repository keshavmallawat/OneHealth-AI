/**
 * Application Shell: Brand, role-based navigation, top bar, system status, theme toggle, and account.
 * Production-quality healthcare SaaS layout with responsive mobile navigation and dark mode.
 */
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity, BellRing, FileText, LayoutDashboard, LogOut, Menu, MessageSquareText,
  Moon, QrCode, ScrollText, Share2, Stethoscope, Sun, TrendingUp, UserCog, Users, X,
  Upload, GitCompareArrows, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { systemApi } from '../services/recordsApi';
import { Avatar } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const PATIENT_NAV: NavGroup[] = [
  {
    heading: 'Clinical Records',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/reports', label: 'Health Records', icon: FileText },
      { to: '/upload', label: 'Upload Report', icon: Upload },
      { to: '/trends', label: 'Trends & Analytics', icon: TrendingUp },
      { to: '/compare', label: 'Compare Reports', icon: GitCompareArrows },
    ],
  },
  {
    heading: 'Care & AI Support',
    items: [
      { to: '/sharing', label: 'Share Access & QR', icon: Share2 },
      { to: '/assistant', label: 'Health Assistant', icon: MessageSquareText },
      { to: '/reminders', label: 'Reminders', icon: BellRing },
    ],
  },
  {
    heading: 'Governance & Identity',
    items: [
      { to: '/activity', label: 'Access History', icon: ScrollText },
      { to: '/profile', label: 'Health Profile', icon: UserCog },
    ],
  },
];

const DOCTOR_NAV: NavGroup[] = [
  {
    heading: 'Clinical Practice',
    items: [
      { to: '/provider', label: 'Patient Roster', icon: Users },
      { to: '/provider/requests', label: 'Pending Access', icon: ScrollText },
      { to: '/provider/connect', label: 'Connect Patient (QR)', icon: QrCode },
    ],
  },
  {
    heading: 'Account',
    items: [
      { to: '/profile', label: 'Provider Profile', icon: UserCog }
    ],
  },
];

/** Live indicator for API and AI service status. */
const SystemStatus: React.FC = () => {
  const [state, setState] = useState<'checking' | 'ok' | 'degraded' | 'down'>('checking');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const data = await systemApi.health();
        if (!active) return;
        setState(data.status === 'ok' ? 'ok' : 'degraded');
        const ai = data.services?.aiService;
        setDetail(
          ai?.reachable
            ? `AI service online · OCR ${ai.capabilities?.ocrAvailable ? 'ready' : 'unavailable'} · summaries ${
                ai.capabilities?.llmConfigured ? 'via language model' : 'deterministic'
              }`
            : 'AI service offline'
        );
      } catch {
        if (active) {
          setState('down');
          setDetail('The API could not be reached');
        }
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const config = {
    checking: { dot: 'bg-slate-400', label: 'Checking...' },
    ok: { dot: 'bg-emerald-500 shadow-sm shadow-emerald-500/50', label: 'System Online' },
    degraded: { dot: 'bg-amber-500', label: 'Limited Service' },
    down: { dot: 'bg-rose-500', label: 'Offline' },
  }[state];

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-2.5 py-1 text-xs text-muted backdrop-blur-sm transition-all"
      title={detail || 'Checking system status'}
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${config.dot}`} aria-hidden="true" />
      <span className="font-medium text-ink-soft hidden sm:inline">{config.label}</span>
    </div>
  );
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isDoctor = user?.role === 'DOCTOR';
  const groups = isDoctor ? DOCTOR_NAV : PATIENT_NAV;
  const home = isDoctor ? '/provider' : '/dashboard';

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const brand = (
    <Link
      to={home}
      className="flex items-center gap-2.5 shrink-0 group"
      onClick={() => setMenuOpen(false)}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-xl bg-sky-500/30 blur-sm group-hover:bg-sky-500/50 transition-all" />
        <span className="relative h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 grid place-items-center text-white shadow-sm shadow-sky-500/30">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="leading-tight">
        <span className="text-base font-bold tracking-tight text-white flex items-center gap-1">
          OneHealth <span className="font-light text-sky-400 text-xs px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/20">AI</span>
        </span>
        <span className="text-[10px] block text-slate-400 font-medium">Digital Health Platform</span>
      </div>
    </Link>
  );

  const navigation = (
    <nav className="flex-1 overflow-y-auto px-3.5 py-5 space-y-6" aria-label="Primary Navigation">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
            {group.heading}
          </p>
          <div className="space-y-1">
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/provider' || to === '/dashboard'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-sky-500/15 text-white shadow-xs border border-sky-500/30 font-bold'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400'}`} aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors duration-200 md:pl-[260px]">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/80 backdrop-blur-md px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 md:hidden">
          <button
            type="button"
            className="rounded-xl border border-line p-2 text-muted hover:bg-sunken hover:text-ink transition-colors"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="md:hidden">
            <span className="text-sm font-bold text-ink tracking-tight flex items-center gap-1">
              OneHealth <span className="text-primary font-normal">AI</span>
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <span className="text-xs font-semibold text-muted tracking-tight">
            {isDoctor ? 'Clinical Workspace' : 'Patient Health Portal'}
          </span>
          <span className="h-4 w-px bg-line" />
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">Encrypted & RBAC Protected</span>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <SystemStatus />

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="relative p-2 rounded-xl border border-line bg-surface hover:bg-sunken text-muted hover:text-ink transition-all shadow-xs cursor-pointer"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="h-4.5 w-4.5 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-slate-700 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* User Quick Capsule */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-line">
            <Avatar name={user?.name || '?'} className="h-8 w-8 text-xs font-bold" />
            <div className="hidden lg:block text-left leading-tight">
              <p className="text-xs font-semibold text-ink truncate max-w-[120px]">{user?.name}</p>
              <p className="text-[10px] text-muted font-medium">{isDoctor ? 'Clinician' : 'Patient'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-slate-900 border-r border-slate-800 text-white
                    transition-transform duration-200 ease-in-out md:translate-x-0 shadow-xl ${
                      menuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-slate-800/80">
          {brand}
          <button
            type="button"
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setMenuOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isDoctor && (
          <div className="mx-4 mt-3 mb-1 flex items-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sky-200">
            <Stethoscope className="h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
            <p className="text-[11px] font-medium leading-tight">
              Provider Mode · Read-only access to shared records
            </p>
          </div>
        )}

        {navigation}

        {/* Sidebar Footer */}
        <div className="mt-auto border-t border-slate-800/80 p-4 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={user?.name || '?'} className="h-8 w-8 text-xs font-bold" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-bold text-white">{user?.name}</p>
                <p className="truncate text-[10px] text-slate-400">{user?.email || (isDoctor ? 'Doctor' : 'Patient')}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Scrim */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm md:hidden animate-in"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Content Area */}
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-[1240px]">{children}</div>
        </main>
        <footer className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1240px] border-t border-line pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
            <p className="leading-relaxed">
              <strong className="font-semibold text-ink">OneHealth AI</strong> — Unified electronic health record platform. Not a diagnostic device.
            </p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                FHIR / HL7 compliant concept
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AppShell;
