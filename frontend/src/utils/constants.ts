export const POLLING_INTERVALS = {
  INVENTORY: 5000,
  FINANCE: 5000,
  DASHBOARD: 30000,
  LISTS: 60000,
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
} as const;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FINANCE_HEAD: 'FINANCE_HEAD',
  PRODUCTION_HEAD: 'PRODUCTION_HEAD',
  LOGISTICS_HEAD: 'LOGISTICS_HEAD',
  MARKETING_HEAD: 'MARKETING_HEAD',
} as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  CREATED: { bg: 'bg-blue-100', text: 'text-blue-800' },
  DISPATCHED: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  RECEIVED: { bg: 'bg-green-100', text: 'text-green-800' },
  PENDING: { bg: 'bg-orange-100', text: 'text-orange-800' },
  ONGOING: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800' },
  APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800' },
};
