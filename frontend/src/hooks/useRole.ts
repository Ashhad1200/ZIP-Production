import { useAuth } from './useAuth';

export function useRole() {
  const { user } = useAuth();

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isAdmin = () => hasRole('SUPER_ADMIN');
  const canViewFinance = () => hasRole('SUPER_ADMIN', 'FINANCE_HEAD');
  const canViewProduction = () => hasRole('SUPER_ADMIN', 'PRODUCTION_HEAD');
  const canViewInventory = () =>
    hasRole('SUPER_ADMIN', 'PRODUCTION_HEAD', 'FINANCE_HEAD', 'LOGISTICS_HEAD');
  const canViewGatePass = () => hasRole('SUPER_ADMIN', 'LOGISTICS_HEAD');
  const canViewOrders = () =>
    hasRole('SUPER_ADMIN', 'FINANCE_HEAD', 'PRODUCTION_HEAD', 'MARKETING_HEAD');

  return {
    hasRole,
    isAdmin,
    canViewFinance,
    canViewProduction,
    canViewInventory,
    canViewGatePass,
    canViewOrders,
    role: user?.role,
  };
}
