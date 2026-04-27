import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/api/client';
import { useCheckinToday } from '@/pulse/hooks';

const NAV_ITEMS = [
  { to: '/',         label: 'Dashboard', key: '1', end: true  },
  { to: '/coach',    label: 'Coach',     key: '2', end: false },
  { to: '/data',     label: 'Data',      key: '3', end: false },
  { to: '/plan',     label: 'Plan',      key: '4', end: false },
  { to: '/settings', label: 'Settings',  key: '⚙', end: false },
];

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { data: checkinData } = useCheckinToday();
  const hasCheckin = !!checkinData?.checkin;

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Sidebar (desktop) ── */}
      <aside
        className="hidden md:flex flex-col shrink-0 w-48 border-r"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span
            className="mono"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: 'var(--accent)',
            }}
          >
            PULSE
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map(({ to, label, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center justify-between rounded px-3 py-2 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[var(--surface-2)] text-[var(--text)]'
                    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                }`
              }
            >
              <span>{label}</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-3)',
                  letterSpacing: '0.06em',
                }}
              >
                {key}
              </span>
              {to === '/coach' && !hasCheckin && (
                <span
                  className="ml-1 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--amber)' }}
                />
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div
          className="px-4 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {user?.name ?? 'Tobi'}
          </span>
          <button
            onClick={handleLogout}
            style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
            className="hover:text-[var(--text)] transition-colors uppercase tracking-widest"
          >
            out
          </button>
        </div>
      </aside>

      {/* ── Mobile topbar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 h-11 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.18em',
            color: 'var(--accent)',
          }}
        >
          PULSE
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-11 pb-14 md:pb-0">
        <div className="max-w-3xl mx-auto px-4 py-5 md:py-6">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] transition-colors ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ background: isActive ? 'var(--accent)' : 'transparent' }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                  {label.toUpperCase()}
                </span>
                {to === '/coach' && !hasCheckin && (
                  <span
                    className="absolute top-1.5 w-1 h-1 rounded-full"
                    style={{ background: 'var(--amber)' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
