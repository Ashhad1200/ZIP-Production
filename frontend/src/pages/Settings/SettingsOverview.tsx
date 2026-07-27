import { useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  FolderTree,
  Layers,
  Factory,
  Settings,
  Briefcase,
  Truck,
  FlaskConical,
} from 'lucide-react';
import { useRole } from '../../hooks/useRole';

interface SettingsCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  adminOnly?: boolean;
}

const cards: SettingsCard[] = [
  {
    title: 'Users',
    description: 'Manage user accounts and role assignments',
    icon: <Users size={24} />,
    path: '/settings/users',
    adminOnly: true,
  },
  {
    title: 'Clients',
    description: 'Manage clients and their payment rates',
    icon: <Building2 size={24} />,
    path: '/settings/clients',
  },
  {
    title: 'Vendors',
    description: 'Manage raw material suppliers',
    icon: <Truck size={24} />,
    path: '/settings/vendors',
    adminOnly: true,
  },
  {
    title: 'Companies',
    description: 'Manage companies used for voucher cheque accounts',
    icon: <Briefcase size={24} />,
    path: '/settings/companies',
    adminOnly: true,
  },
  {
    title: 'Expense Categories',
    description: 'Organise expense categories in a tree structure',
    icon: <FolderTree size={24} />,
    path: '/settings/expense-categories',
    adminOnly: true,
  },
  {
    title: 'Recipes / Formulas',
    description: 'Create reusable grain-mix recipes for variants',
    icon: <FlaskConical size={24} />,
    path: '/settings/recipes',
    adminOnly: true,
  },
  {
    title: 'Variants & Raw Material Types',
    description: 'Configure product variants and raw material type definitions',
    icon: <Layers size={24} />,
    path: '/settings/variants',
    adminOnly: true,
  },
  {
    title: 'Plants & Workers',
    description: 'Manage plants, machines, and worker assignments',
    icon: <Factory size={24} />,
    path: '/settings/plants',
    adminOnly: true,
  },
  {
    title: 'System Settings',
    description: 'Configure application-wide settings and parameters',
    icon: <Settings size={24} />,
    path: '/settings/system',
    adminOnly: true,
  },
];

export function SettingsOverview() {
  const navigate = useNavigate();
  const { isAdmin } = useRole();

  const visibleCards = cards.filter((c) => !c.adminOnly || isAdmin());

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Configure and manage application settings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="flex min-h-[100px] items-start gap-4 rounded-lg border bg-white p-5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"
          >
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              {card.icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {card.title}
              </h3>
              <p className="mt-1 text-xs text-gray-500">{card.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
