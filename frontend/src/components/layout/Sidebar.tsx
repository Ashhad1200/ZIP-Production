import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  Package,
  Truck,
  ClipboardList,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { useRole } from '../../hooks/useRole';
import { ROLES } from '../../utils/constants';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  children?: { label: string; path: string; roles: string[] }[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard size={20} />,
    roles: Object.values(ROLES),
  },
  {
    label: 'Production',
    path: '/production',
    icon: <Factory size={20} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD],
  },
  {
    label: 'Inventory',
    path: '/inventory',
    icon: <Package size={20} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD, ROLES.FINANCE_HEAD, ROLES.LOGISTICS_HEAD],
    children: [
      {
        label: 'Raw Materials',
        path: '/inventory/raw-materials',
        roles: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD, ROLES.FINANCE_HEAD, ROLES.LOGISTICS_HEAD],
      },
      {
        label: 'Finished Goods',
        path: '/inventory/finished-goods',
        roles: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD, ROLES.FINANCE_HEAD, ROLES.LOGISTICS_HEAD],
      },
      {
        label: 'Purchases',
        path: '/inventory/purchases',
        roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD],
      },
      {
        label: 'Consumption Report',
        path: '/inventory/consumption-report',
        roles: [ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD, ROLES.FINANCE_HEAD],
      },
    ],
  },
  {
    label: 'Gate Pass',
    path: '/gate-pass',
    icon: <Truck size={20} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.LOGISTICS_HEAD],
  },
  {
    label: 'Orders',
    path: '/orders',
    icon: <ClipboardList size={20} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD, ROLES.PRODUCTION_HEAD, ROLES.MARKETING_HEAD],
  },
  {
    label: 'Finance',
    path: '/finance',
    icon: <DollarSign size={20} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD],
    children: [
      {
        label: 'Client Ledger',
        path: '/finance/client-ledger',
        roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD],
      },
      {
        label: 'Vouchers',
        path: '/finance/vouchers',
        roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD],
      },
      {
        label: 'Reports',
        path: '/finance/reports',
        roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD],
      },
    ],
  },
  {
    label: 'HR & Payroll',
    path: '/hr',
    icon: <UserCheck size={20} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.HR_HEAD],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings size={20} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { hasRole } = useRole();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(
    new Set(
      navItems
        .filter(
          (item) =>
            item.children &&
            item.children.some((c) => location.pathname.startsWith(c.path)),
        )
        .map((item) => item.path),
    ),
  );

  const toggleSubmenu = (path: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const visibleItems = navItems.filter((item) => hasRole(...item.roles));

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700'
        : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <aside
      className={`hidden md:flex flex-col border-r bg-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between border-b px-3">
        {!collapsed && (
          <span className="text-lg font-bold text-gray-900">ZIP ERP</span>
        )}
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <ChevronLeft
            size={18}
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.path}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleSubmenu(item.path)}
                    className={`w-full ${linkClass(location.pathname.startsWith(item.path))}`}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {expandedMenus.has(item.path) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </>
                    )}
                  </button>
                  {!collapsed && expandedMenus.has(item.path) && (
                    <ul className="ml-8 mt-1 space-y-1">
                      {item.children
                        .filter((child) => hasRole(...child.roles))
                        .map((child) => (
                          <li key={child.path}>
                            <NavLink
                              to={child.path}
                              className={({ isActive }) => linkClass(isActive)}
                            >
                              <span className="text-sm">{child.label}</span>
                            </NavLink>
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              ) : (
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => linkClass(isActive)}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
