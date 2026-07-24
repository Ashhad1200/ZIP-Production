import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, Package, Landmark, LogOut } from 'lucide-react';
import { usePlatformAuth } from '../../hooks/usePlatformAuth';
import { LoadingSpinner } from '../../components/ui';

const navItems = [
  { to: '/backoffice', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/backoffice/organizations', label: 'Organizations', icon: Building2 },
  { to: '/backoffice/plans', label: 'Plans', icon: Package },
  { to: '/backoffice/payments', label: 'Payments', icon: Landmark },
];

export function BackofficeLayout() {
  const { isAuthenticated, isLoading, admin, logout } = usePlatformAuth();

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (!isAuthenticated) return <Navigate to="/backoffice/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-gray-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold">BD Matrix Backoffice</span>
            <nav className="hidden gap-1 md:flex">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                      isActive ? 'bg-white/15 font-medium' : 'text-gray-300 hover:bg-white/10'
                    }`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <span>{admin?.name}</span>
            <button onClick={() => logout()} className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/10">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-4 py-2 md:hidden">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-white/15 font-medium' : 'text-gray-300'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
