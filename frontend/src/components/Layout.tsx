import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/api/client';
import { useNavHotkeys } from '@/hooks/useHotkeys';
import { focusCssVars } from '@/lib/theme';

const NAV_ITEMS = [
  { to: '/',          label: 'Heute',     mobileLabel: 'Heute',    key: '1', end: true  },
  { to: '/data',      label: 'Data',      mobileLabel: 'Data',     key: '2', end: false },
  { to: '/plan',      label: 'Plan',      mobileLabel: 'Plan',     key: '3', end: false },
  { to: '/insights',  label: 'Insights',  mobileLabel: 'Insights', key: '4', end: false },
  { to: '/settings',  label: 'Settings',  mobileLabel: 'Settings', key: '5', end: false },
];

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [coachOpen, setCoachOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useNavHotkeys();

  const isOperationalRoute = location.pathname === '/' || location.pathname.startsWith('/data') || location.pathname.startsWith('/plan') || location.pathname.startsWith('/insights');
  const pageShellStyle = isOperationalRoute ? { maxWidth: 1120 } : undefined;
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

      <header
        className="pulse-shell-topbar hidden md:flex items-center justify-between px-[18px] border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pulse-brand-mark" aria-hidden="true" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '.18em' }}>
            PULSE.OS
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>v2.1</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
          <span><span style={{ color: 'var(--green)' }}>●</span> sync bereit</span>
          <span>{today}</span>
          <span style={{ color: 'var(--text)' }}>{user?.name ?? 'Tobi'}</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Sidebar (desktop) ── */}
      <aside
        className="pulse-focus-sidebar hidden md:flex flex-col shrink-0 border-r"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)', padding: '14px 8px' }}
      >
        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-px">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.18em', padding: '4px 10px 8px' }}>
            NAVIGATION
          </div>
          {NAV_ITEMS.map(({ to, label, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center justify-between rounded-[4px] px-[10px] py-2 text-[12.5px] transition-colors ${
                  isActive
                    ? 'bg-[var(--surface-2)] text-[var(--text)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                }`
              }
              style={({ isActive }) => ({
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              })}
            >
              <span>{label}</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-3)',
                  letterSpacing: 0,
                }}
              >
                {key}
              </span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', lineHeight: 1.6 }}>
          <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>SYSTEM</div>
          <div>garmin <span style={{ color: 'var(--green)' }}>bereit</span></div>
          <div>server lokal</div>
        </div>

        <button
          type="button"
          onClick={() => setCoachOpen(true)}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: '8px 10px',
            border: '1px dashed var(--accent)',
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '.14em',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          ⌘K · COACH
        </button>

        <div
          className="mt-2 px-2 py-2 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {user?.name ?? 'Tobi'}
          </span>
          <button
            onClick={handleLogout}
            style={{ minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
            className="hover:text-[var(--text)] transition-colors uppercase tracking-widest"
          >
            out
          </button>
        </div>
      </aside>

      {/* ── Mobile topbar ── */}
      <div
        className="pulse-mobile-topbar md:hidden fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pulse-brand-mark" aria-hidden="true" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '.18em', color: 'var(--text)' }}>
            PULSE.OS
          </span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: 0 }}>
          {new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
        </span>
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
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {NAV_ITEMS.map(({ to, label, mobileLabel, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative' }}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    width: 16, height: 2, borderRadius: 1,
                    background: isActive ? 'var(--accent)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8.5,
                  letterSpacing: 0, textTransform: 'uppercase',
                  color: isActive ? 'var(--accent)' : 'var(--text-3)',
                  lineHeight: 1.15, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'color 0.15s',
                }}>
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
    ['2', 'Data'],
    ['3', 'Plan'],
    ['4', 'Insights'],
    ['5', 'Settings'],
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
            <div className="label-mono" style={{ color: 'var(--accent)' }}>SHORTCUTS</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 500 }}>Tastaturhilfe</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tastaturhilfe schließen"
            style={{ minWidth: 44, minHeight: 44, background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
          >
            ×
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
            <div className="label-mono" style={{ color: 'var(--accent)' }}>⌘K · COACH</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 500 }}>Was soll Pulse klären?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ minWidth: 44, minHeight: 44, background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
          >
            ×
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
