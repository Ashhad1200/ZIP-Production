import { Role } from '@prisma/client';

const FINANCIAL_FIELDS = [
  'ratePerMeterPaisa',
  'ratePerMeterDisplay',
  'lineAmountPaisa',
  'lineAmountDisplay',
  'totalAmountPaisa',
  'totalAmountDisplay',
  'clientOutstandingPaisa',
  'clientOutstandingDisplay',
  'amountPaisa',
  'amountDisplay',
  'overdueAmountPaisa',
  'overdueAmountDisplay',
  'ratePerBagPaisa',
  'ratePerBagDisplay',
];

const FINANCIAL_RESTRICTED_ROLES: Role[] = [Role.PRODUCTION_HEAD, Role.MARKETING_HEAD];

/**
 * Strip financial fields from an object based on the requesting user's role.
 */
export function stripFinancialFields<T extends Record<string, unknown>>(
  data: T,
  userRole: Role
): T {
  if (!FINANCIAL_RESTRICTED_ROLES.includes(userRole)) {
    return data;
  }

  const result = { ...data };
  for (const field of FINANCIAL_FIELDS) {
    if (field in result) {
      delete result[field];
    }
  }

  // Also strip financial fields from nested lineItems arrays
  if ('lineItems' in result && Array.isArray((result as Record<string, unknown>).lineItems)) {
    (result as Record<string, unknown>).lineItems = ((result as Record<string, unknown>).lineItems as Record<string, unknown>[]).map(item => {
      const stripped = { ...item };
      for (const field of FINANCIAL_FIELDS) {
        if (field in stripped) {
          delete stripped[field];
        }
      }
      return stripped;
    });
  }

  return result;
}

/**
 * Strip financial fields from an array of objects.
 */
export function stripFinancialFieldsFromList<T extends Record<string, unknown>>(
  data: T[],
  userRole: Role
): T[] {
  if (!FINANCIAL_RESTRICTED_ROLES.includes(userRole)) {
    return data;
  }
  return data.map(item => stripFinancialFields(item, userRole));
}
