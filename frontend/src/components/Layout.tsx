import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/api/client';

const NAV_ITEMS = [
  { to: '/',        label: 'Home',    icon: '⚡', end: true  },
  { to: '/coach',   label: 'Coach',   icon: '💬', end: false },
  { to: '/data',    label: 'Daten',   icon: '📊', end: false },
  { to: '/plan',    label: 'Plan',    icon: '📅', end: false },
  { to: '/settings',label: 'Settings',icon: '⚙️', end: false },
];

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="text-primary font-bold tracking-widest text-sm">PULSE</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full overflow-y-auto">
        <Outlet />
      </main>

      <nav className="border-t border-border px-2 py-2 flex justify-around shrink-0">
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <span className="text-lg leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
