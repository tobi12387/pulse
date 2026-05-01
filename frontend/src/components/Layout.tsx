import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/api/client';
import { useCheckinToday } from '@/pulse/hooks';
import { useNavHotkeys } from '@/hooks/useHotkeys';

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard', mobileLabel: 'Home',    key: '1', end: true  },
  { to: '/coach',     label: 'Coach',     mobileLabel: 'Coach',   key: '2', end: false },
  { to: '/data',      label: 'Data',      mobileLabel: 'Data',    key: '3', end: false },
  { to: '/plan',      label: 'Plan',      mobileLabel: 'Plan',    key: '4', end: false },
  { to: '/insights',  label: 'Insights',  mobileLabel: 'Insights', key: '5', end: false },
  { to: '/settings',  label: 'Settings',  mobileLabel: 'Settings', key: '6', end: false },
];

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { data: checkinData } = useCheckinToday();
  const hasCheckin = !!checkinData?.checkin;
  useNavHotkeys();

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="pulse-app-shell flex overflow-hidden">

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
              letterSpacing: 0,
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
                  letterSpacing: 0,
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
      <div
        className="pulse-mobile-topbar md:hidden fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: 0, color: 'var(--accent)' }}>
          PULSE
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: 0 }}>
          {new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}
        </span>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="pulse-page-shell mx-auto px-4 max-w-3xl">
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
                {to === '/coach' && !hasCheckin && (
                  <span
                    style={{
                      position: 'absolute', top: 6, right: 'calc(50% - 14px)',
                      width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)',
                    }}
                  />
                )}
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
    </div>
  );
}
