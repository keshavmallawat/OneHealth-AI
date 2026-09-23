/**
 * Application chrome: brand, primary navigation, system status, account.
 *
 * The navigation is derived from the signed-in role. A patient and a clinician
 * are doing genuinely different jobs, so they get different products rather
 * than one product with disabled buttons — and no navigation item ever points
 * at something that is not implemented.
 */
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity, BellRing, FileText, LayoutDashboard, LogOut, Menu, MessageSquareText,
  QrCode, ScrollText, Share2, Stethoscope, TrendingUp, UserCog, Users, X, Upload, GitCompareArrows
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
    heading: 'Health record',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/reports', label: 'Health Records', icon: FileText },
      { to: '/upload', label: 'Upload Report', icon: Upload },
      { to: '/trends', label: 'Trends', icon: TrendingUp },
      { to: '/compare', label: 'Compare Reports', icon: GitCompareArrows },
    ],
  },
  {
    heading: 'Care and sharing',
    items: [
      { to: '/sharing', label: 'Share Access', icon: Share2 },
      { to: '/assistant', label: 'Health Assistant', icon: MessageSquareText },
      { to: '/reminders', label: 'Reminders', icon: BellRing },
    ],
  },
  {
    heading: 'Account',
    items: [
      { to: '/activity', label: 'Access History', icon: ScrollText },
      { to: '/profile', label: 'Profile', icon: UserCog },
    ],
  },
];

const DOCTOR_NAV: NavGroup[] = [
  {
    heading: 'Practice',
    items: [
      { to: '/provider', label: 'Patients / Shared Records', icon: Users },
      { to: '/provider/requests', label: 'Pending Access', icon: ScrollText },
      { to: '/provider/connect', label: 'Connect Patient (QR)', icon: QrCode },
    ],
  },
  {
    heading: 'Account',
    items: [
      { to: '/profile', label: 'Profile', icon: UserCog }
    ],
  },
];

/** Live indicator for the API and AI service. */
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

  const dot = {
    checking: 'bg-faint',
    ok: 'bg-normal',
    degraded: 'bg-low',
    down: 'bg-high',
  }[state];

  const label = {
    checking: 'Checking connection…',
    ok: 'Secure connection',
    degraded: 'Limited service',
    down: 'Offline',
  }[state];

  return (
    <span
      className="inline-flex items-center gap-2 text-xs text-muted"
      title={detail || 'Checking system status'}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isDoctor = user?.role === 'DOCTOR';
  const groups = isDoctor ? DOCTOR_NAV : PATIENT_NAV;
  const home = isDoctor ? '/provider' : '/dashboard';

  // Close the mobile navigation drawer on Escape, matching the scrim click.
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
      className="flex items-center gap-2.5 shrink-0"
      onClick={() => setMenuOpen(false)}
    >
      <span className="h-7 w-7 rounded-md bg-white/10 grid place-items-center">
        <Activity className="h-4 w-4 text-white" aria-hidden="true" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">
        OneHealth <span className="font-normal text-white/60">AI</span>
      </span>
    </Link>
  );

  const navigation = (
    <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-8" aria-label="Primary">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            {group.heading}
          </p>
          <div className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/provider'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas md:pl-[248px]">
      {/* Mobile bar */}
      <div className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4">
        {brand}
        <button
          type="button"
          className="rounded-md border border-line p-1.5 text-muted hover:bg-sunken transition-colors"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-primary-ink
                    transition-transform duration-200 md:translate-x-0 ${
                      menuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
      >
        <div className="flex h-16 shrink-0 items-center px-6">{brand}</div>

        {isDoctor && (
          <div className="mx-4 mt-2 mb-4 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
            <Stethoscope className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden="true" />
            <p className="text-[11px] font-medium text-white/80 leading-tight">
              Provider view — patient records are read-only
            </p>
          </div>
        )}

        {navigation}

        <div className="mt-auto border-t border-white/10 p-4">
          <div className="px-2 pb-4 opacity-70">
            <SystemStatus />
          </div>
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar name={user?.name || '?'} className="h-8 w-8 bg-white/10 text-white border-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-white/60">{isDoctor ? 'Clinician' : 'Patient'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/25 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-[1180px]">{children}</div>
        </main>
        <footer className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1180px] border-t border-line pt-5">
            <p className="text-xs leading-relaxed text-muted">
              OneHealth AI — unified digital health record platform. AI features provide
              informational decision support and are not a medical diagnosis. Always consult a
              qualified healthcare professional.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AppShell;
