import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  Package,
  Truck,
  ClipboardList,
  DollarSign,
  Settings,
} from 'lucide-react';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../utils/constants';
import type { ReactNode } from 'react';

interface MobileNavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: string[];
}

const allItems: MobileNavItem[] = [
  { label: 'Home', path: '/', icon: <LayoutDashboard size={20} />, roles: Object.values(ROLES) },
  { label: 'Production', path: '/production', icon: <Factory size={20} />, roles: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD] },
  { label: 'Inventory', path: '/inventory', icon: <Package size={20} />, roles: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD, ROLES.FINANCE_HEAD, ROLES.LOGISTICS_HEAD] },
  { label: 'Gate Pass', path: '/gate-pass', icon: <Truck size={20} />, roles: [ROLES.SUPER_ADMIN, ROLES.LOGISTICS_HEAD] },
  { label: 'Orders', path: '/orders', icon: <ClipboardList size={20} />, roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD, ROLES.PRODUCTION_HEAD, ROLES.MARKETING_HEAD] },
  { label: 'Finance', path: '/finance', icon: <DollarSign size={20} />, roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD] },
  { label: 'Settings', path: '/settings', icon: <Settings size={20} />, roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD] },
];

export function MobileNav() {
  const { hasRole } = useRole();

  // Show the first 5 items the user can access
  const visibleItems = allItems.filter((item) => hasRole(...item.roles)).slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden">
      <div className="flex items-center justify-around">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
