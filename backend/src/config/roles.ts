import { Role } from '@prisma/client';

// Defines which roles can access which module endpoints
export const ROLE_PERMISSIONS: Record<string, Role[]> = {
  // Auth - public for kiosk, me requires auth
  'auth:users': [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.PRODUCTION_HEAD, Role.LOGISTICS_HEAD, Role.MARKETING_HEAD, Role.HR_HEAD],
  'auth:me': [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.PRODUCTION_HEAD, Role.LOGISTICS_HEAD, Role.MARKETING_HEAD, Role.HR_HEAD],
  
  // Production
  'production:read': [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD],
  'production:write': [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD],
  'production:edit': [Role.SUPER_ADMIN],
  'production:discrepancies': [Role.SUPER_ADMIN],
  
  // Inventory
  'inventory:read': [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD, Role.FINANCE_HEAD, Role.LOGISTICS_HEAD],
  'inventory:write': [Role.SUPER_ADMIN, Role.FINANCE_HEAD],
  'inventory:threshold': [Role.SUPER_ADMIN],
  
  // Gate Pass
  'gate-pass:read': [Role.SUPER_ADMIN, Role.LOGISTICS_HEAD],
  'gate-pass:write': [Role.SUPER_ADMIN, Role.LOGISTICS_HEAD],
  
  // Orders
  'orders:read': [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.PRODUCTION_HEAD, Role.MARKETING_HEAD],
  'orders:write': [Role.SUPER_ADMIN, Role.FINANCE_HEAD],
  'orders:approve': [Role.SUPER_ADMIN, Role.FINANCE_HEAD],
  
  // Finance
  'finance:read': [Role.SUPER_ADMIN, Role.FINANCE_HEAD],
  'finance:write': [Role.SUPER_ADMIN, Role.FINANCE_HEAD],
  'finance:approve': [Role.SUPER_ADMIN],
  
  // HR
  'hr:read': [Role.SUPER_ADMIN, Role.HR_HEAD, Role.FINANCE_HEAD],
  'hr:write': [Role.SUPER_ADMIN, Role.HR_HEAD],
  
  // Dashboard
  'dashboard:read': [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.PRODUCTION_HEAD, Role.LOGISTICS_HEAD, Role.MARKETING_HEAD, Role.HR_HEAD],
  
  // Settings
  'settings:read': [Role.SUPER_ADMIN],
  'settings:write': [Role.SUPER_ADMIN],
  'settings:clients': [Role.SUPER_ADMIN, Role.FINANCE_HEAD],
  
  // Notifications
  'notifications:read': [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.PRODUCTION_HEAD, Role.LOGISTICS_HEAD, Role.MARKETING_HEAD, Role.HR_HEAD],
};

// Roles that should NOT see financial fields in API responses
export const FINANCIAL_FIELD_RESTRICTED_ROLES: Role[] = [
  Role.PRODUCTION_HEAD,
  Role.MARKETING_HEAD,
  Role.HR_HEAD,
];
