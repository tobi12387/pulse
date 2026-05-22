import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  Command,
  Database,
  Home,
  LogOut,
  Settings,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/api/client';
import { useNavHotkeys } from '@/hooks/useHotkeys';
import { focusCssVars } from '@/lib/theme';

const NAV_ITEMS = [
  { to: '/', label: 'Heute', mobileLabel: 'Heute', description: 'Entscheiden', intent: 'eine Antwort', key: '01', end: true, icon: Home },
  { to: '/plan', label: 'Plan', mobileLabel: 'Plan', description: 'Steuern', intent: 'bewusst ändern', key: '02', end: false, icon: CalendarDays },
  { to: '/data', label: 'Daten', mobileLabel: 'Daten', description: 'Erfassen', intent: 'Lücken schließen', key: '03', end: false, icon: Database },
  { to: '/insights', label: 'Analyse', mobileLabel: 'Analyse', description: 'Lernen', intent: 'Muster prüfen', key: '04', end: false, icon: BarChart3 },
  { to: '/settings', label: 'Setup', mobileLabel: 'Setup', description: 'Bereitmachen', intent: 'System stabil', key: '05', end: false, icon: Settings },
];

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [coachOpen, setCoachOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useNavHotkeys();

  const isOperationalRoute = location.pathname === '/'
    || location.pathname.startsWith('/data')
    || location.pathname.startsWith('/plan')
    || location.pathname.startsWith('/insights')
    || location.pathname.startsWith('/settings');
  const activeNavItem = NAV_ITEMS.find(item => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)) ?? NAV_ITEMS[0];
  const pageShellStyle = isOperationalRoute ? { maxWidth: 1220 } : undefined;
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).toUpperCase();
  useEffect(() => {
    function handleCommand(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(target?.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (isTyping) return;
        event.preventDefault();
        setHelpOpen(false);
        setCoachOpen(open => !open);
      }
      const isHelpShortcut = event.key === '?' || (event.shiftKey && (event.key === '/' || event.code === 'Slash'));
      if (!isTyping && !event.metaKey && !event.ctrlKey && !event.altKey && isHelpShortcut) {
        event.preventDefault();
        setCoachOpen(false);
        setHelpOpen(open => !open);
      }
      if (!isTyping && event.key === 'Escape') {
        setCoachOpen(false);
        setHelpOpen(false);
      }
    }

    window.addEventListener('keydown', handleCommand);
    return () => window.removeEventListener('keydown', handleCommand);
  }, []);

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="pulse-app-shell flex flex-col overflow-hidden" style={focusCssVars as CSSProperties}>

      <header className="pulse-shell-topbar hidden md:grid border-b">
        <div className="pulse-brand-lockup">
          <span className="pulse-brand-mark" aria-hidden="true" />
          <div>
            <div className="pulse-brand-title">Pulse</div>
            <div className="pulse-brand-subtitle">Private Performance OS</div>
          </div>
        </div>
        <div className="pulse-topbar-command" aria-label="Aktueller Arbeitsmodus">
          <span>{activeNavItem.key}</span>
          <strong>{activeNavItem.description}</strong>
          <em>{activeNavItem.intent}</em>
        </div>
        <div className="pulse-topbar-context">
          <span className="pulse-status-chip"><Wifi size={14} aria-hidden="true" /> Sync bereit</span>
          <span>{today}</span>
          <span>{user?.name ?? 'Tobi'}</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Sidebar (desktop) ── */}
      <aside
        className="pulse-focus-sidebar hidden md:flex flex-col shrink-0 border-r"
      >
        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-px">
          <div className="pulse-sidebar-section-label">Workspaces</div>
          {NAV_ITEMS.map(({ to, label, description, key, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `pulse-nav-link ${isActive ? 'pulse-nav-link--active' : ''}`
              }
            >
              <span className="pulse-nav-icon" aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span>
              <span className="pulse-nav-copy">
                <span className="pulse-nav-label">{label}</span>
                <span className="pulse-nav-description">{description}</span>
              </span>
              <span className="pulse-nav-key">{key}</span>
            </NavLink>
          ))}
        </nav>

        <div className="pulse-sidebar-card pulse-sidebar-card--handoff" aria-label="Aktueller Workspace">
          <div className="pulse-sidebar-card-label">Jetzt</div>
          <div className="pulse-sidebar-card-title">{activeNavItem.description}</div>
          <p>{activeNavItem.label} zeigt nur den nächsten sinnvollen Schritt; Details liegen eine Ebene tiefer.</p>
        </div>

        <button
          type="button"
          onClick={() => setCoachOpen(true)}
          className="pulse-coach-command"
        >
          <Command size={15} aria-hidden="true" />
          Coach
        </button>

        <div
          className="pulse-user-strip"
        >
          <span>
            {user?.name ?? 'Tobi'}
          </span>
          <button
            onClick={handleLogout}
            className="pulse-icon-button"
            aria-label="Abmelden"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* ── Mobile topbar ── */}
      <div
        className="pulse-mobile-topbar md:hidden fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 border-b"
      >
        <span className="pulse-brand-lockup pulse-brand-lockup--mobile">
          <span className="pulse-brand-mark" aria-hidden="true" />
          <span className="pulse-mobile-route-copy">
            <span className="pulse-mobile-route-title">{activeNavItem.mobileLabel ?? activeNavItem.label}</span>
            <span className="pulse-mobile-route-subtitle">Pulse · {activeNavItem.intent}</span>
          </span>
        </span>
        <button
          type="button"
          className="pulse-icon-button pulse-mobile-command-button"
          onClick={() => setCoachOpen(true)}
          aria-label="Coach öffnen"
        >
          <Sparkles size={17} aria-hidden="true" />
        </button>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="pulse-page-shell mx-auto px-4 max-w-3xl" style={pageShellStyle} data-route-width={isOperationalRoute ? 'operational' : 'standard'}>
          <Outlet />
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="pulse-mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-10 flex border-t"
      >
        {NAV_ITEMS.map(({ to, label, mobileLabel, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="pulse-mobile-nav-link"
            aria-label={label}
          >
            {({ isActive }) => (
              <>
                <span className={`pulse-mobile-nav-icon ${isActive ? 'pulse-mobile-nav-icon--active' : ''}`}>
                  <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className={isActive ? 'pulse-mobile-nav-label pulse-mobile-nav-label--active' : 'pulse-mobile-nav-label'}>
                  {mobileLabel ?? label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <CoachCommandDrawer
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        onOpenCoach={() => {
          setCoachOpen(false);
          navigate('/coach?focus=daily');
        }}
        onOpenData={() => {
          setCoachOpen(false);
          navigate('/data?tab=today#data-mental');
        }}
      />
      <KeyboardHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </div>
  );
}

function KeyboardHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      restoreTarget?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const shortcuts = [
    ['1', 'Heute'],
    ['2', 'Plan'],
    ['3', 'Daten'],
    ['4', 'Analyse'],
    ['5', 'Setup'],
    ['⌘K', 'Coach'],
    ['?', 'Tastaturhilfe'],
    ['Esc', 'Schließen'],
  ];

  return (
    <>
      <div
        aria-hidden="true"
        onMouseDown={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.56)' }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tastaturhilfe"
        tabIndex={-1}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 51,
          width: 'min(420px, calc(100vw - 32px))',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 18,
          boxShadow: '0 22px 60px rgba(0,0,0,0.42)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div className="label-mono" style={{ color: 'var(--accent)' }}>Shortcuts</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 500 }}>Tastaturhilfe</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tastaturhilfe schließen"
            className="pulse-icon-button"
          >
            <CircleHelp size={15} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: 'grid', gap: 7 }}>
          {shortcuts.map(([key, label]) => (
            <div
              key={`${key}-${label}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{key}</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CoachCommandDrawer({
  open,
  onClose,
  onOpenCoach,
  onOpenData,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCoach: () => void;
  onOpenData: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      (primaryActionRef.current ?? dialogRef.current)?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      restoreTarget?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  function getFocusableNodes() {
    return Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(element => element.offsetParent !== null);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = getFocusableNodes();
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (event.shiftKey && (!activeElement || activeElement === first || !dialogRef.current?.contains(activeElement))) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        onMouseDown={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.48)', border: 'none' }}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Coach Command"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        style={{
          position: 'fixed',
          top: 44,
          right: 0,
          bottom: 0,
          zIndex: 41,
          width: 'min(380px, 100vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '-18px 0 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div>
            <div className="label-mono" style={{ color: 'var(--accent)' }}>Coach</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 500 }}>Was soll Pulse klären?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pulse-icon-button"
          >
            <Sparkles size={15} aria-hidden="true" />
          </button>
        </div>
        <button
          ref={primaryActionRef}
          type="button"
          onClick={onOpenCoach}
          style={{ minHeight: 56, padding: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--accent)', borderRadius: 5, textAlign: 'left', cursor: 'pointer' }}
        >
          <span className="label-mono" style={{ color: 'var(--accent)' }}>Daily Coach</span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Tagesentscheidung im Coach öffnen, ohne einen Haupttab für Coach zu brauchen.
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenData}
          style={{ minHeight: 56, padding: 12, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 5, textAlign: 'left', cursor: 'pointer' }}
        >
          <span className="label-mono">Check-in öffnen</span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Mentalen Tageszustand eintragen, damit Plan und Briefing mit echtem Kontext arbeiten.
          </span>
        </button>
      </aside>
    </>
  );
}
