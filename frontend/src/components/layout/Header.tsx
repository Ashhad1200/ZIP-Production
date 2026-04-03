import { Menu, Bell, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleBadgeColor: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800',
    FINANCE_HEAD: 'bg-green-100 text-green-800',
    PRODUCTION_HEAD: 'bg-blue-100 text-blue-800',
    LOGISTICS_HEAD: 'bg-yellow-100 text-yellow-800',
    MARKETING_HEAD: 'bg-pink-100 text-pink-800',
  };

  const badgeClass = user
    ? roleBadgeColor[user.role] ?? 'bg-gray-100 text-gray-800'
    : '';

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 md:hidden">
          ZIP ERP
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}
              >
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
