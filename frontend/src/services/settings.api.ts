import api from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  paymentCycleDays: number;
  clientRates?: {
    id: string;
    variantId: string;
    ratePerMeterPaisa: number;
    variant?: { code: string; name: string };
  }[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  children?: ExpenseCategory[];
}

export interface Company {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export interface VariantIngredient {
  grainTypeId: string;
  ratioPercent: number;
  grainType: { id: string; code: string; name: string; bagWeightGrams: number };
}

export interface Variant {
  id: string;
  code: string;
  name: string;
  description: string | null;
  standardGramsPerMeter: number;
  grainTypeId: string | null;
  isActive: boolean;
  grainType?: { id: string; code: string; name: string; bagWeightGrams: number } | null;
  ingredients: VariantIngredient[];
}

export interface GrainType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  bagWeightGrams: number;
  lowStockThresholdBags: number | null;
  isActive: boolean;
}

export interface Plant {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
  machines: Machine[];
}

export interface Machine {
  id: string;
  identifier: string;
  kwhRating: number;
  expectedOutputPerShift: number | null;
  isActive: boolean;
}

export interface Worker {
  id: string;
  name: string;
  designation: string | null;
  isActive: boolean;
  plantId: string | null;
  plant?: { id: string; name: string } | null;
  shiftCostPaisa: number | null;
}

export interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
}

// ─── API Methods ────────────────────────────────────────────────────────────

export const settingsApi = {
  // Users
  getUsers: () =>
    api.get<{ data: User[] }>('/settings/users').then((r) => r.data),
  createUser: (data: { name: string; role: string }) =>
    api.post<{ data: User }>('/settings/users', data).then((r) => r.data),
  updateUser: (
    id: string,
    data: Partial<{ name: string; role: string; isActive: boolean }>,
  ) => api.put<{ data: User }>(`/settings/users/${id}`, data).then((r) => r.data),
  deactivateUser: (id: string) =>
    api.delete(`/settings/users/${id}`).then((r) => r.data),

  // Clients
  getClients: () =>
    api.get<{ data: Client[] }>('/settings/clients').then((r) => r.data),
  createClient: (data: {
    name: string;
    contactPerson?: string;
    phone?: string;
    address?: string;
    paymentCycleDays?: number;
    rates?: { variantId: string; ratePerMeterPaisa: number }[];
  }) => api.post<{ data: Client }>('/settings/clients', data).then((r) => r.data),
  updateClient: (id: string, data: Partial<Client>) =>
    api.put<{ data: Client }>(`/settings/clients/${id}`, data).then((r) => r.data),

  // Expense Categories
  getExpenseCategories: () =>
    api
      .get<{ data: ExpenseCategory[] }>('/settings/expense-categories')
      .then((r) => r.data),
  createExpenseCategory: (data: { name: string; parentId?: string }) =>
    api
      .post<{ data: ExpenseCategory }>('/settings/expense-categories', data)
      .then((r) => r.data),
  updateExpenseCategory: (
    id: string,
    data: { name?: string; isActive?: boolean },
  ) =>
    api
      .put<{ data: ExpenseCategory }>(`/settings/expense-categories/${id}`, data)
      .then((r) => r.data),
  deleteExpenseCategory: (id: string) =>
    api.delete(`/settings/expense-categories/${id}`).then((r) => r.data),

  // Companies
  getCompanies: () =>
    api.get<{ data: Company[] }>('/settings/companies').then((r) => r.data),
  createCompany: (data: { name: string; address?: string }) =>
    api.post<{ data: Company }>('/settings/companies', data).then((r) => r.data),
  updateCompany: (id: string, data: Partial<Company>) =>
    api.put<{ data: Company }>(`/settings/companies/${id}`, data).then((r) => r.data),

  // Variants
  getVariants: () =>
    api.get<{ data: Variant[] }>('/settings/variants').then((r) => r.data),
  createVariant: (data: {
    code: string;
    name: string;
    standardGramsPerMeter: number;
    ingredients: { grainTypeId: string; ratioPercent: number }[];
    description?: string;
  }) =>
    api.post<{ data: Variant }>('/settings/variants', data).then((r) => r.data),
  updateVariant: (id: string, data: {
    name?: string;
    standardGramsPerMeter?: number;
    description?: string | null;
    isActive?: boolean;
    ingredients?: { grainTypeId: string; ratioPercent: number }[];
  }) =>
    api.put<{ data: Variant }>(`/settings/variants/${id}`, data).then((r) => r.data),

  // Grain Types
  getGrainTypes: () =>
    api.get<{ data: GrainType[] }>('/settings/grain-types').then((r) => r.data),
  createGrainType: (data: {
    code: string;
    name: string;
    bagWeightGrams: number;
    lowStockThresholdBags?: number;
    description?: string;
  }) =>
    api
      .post<{ data: GrainType }>('/settings/grain-types', data)
      .then((r) => r.data),
  updateGrainType: (id: string, data: Partial<GrainType>) =>
    api
      .put<{ data: GrainType }>(`/settings/grain-types/${id}`, data)
      .then((r) => r.data),

  // Plants & Machines
  getPlants: () =>
    api.get<{ data: Plant[] }>('/settings/plants').then((r) => r.data),
  updatePlant: (id: string, data: { name?: string; location?: string }) =>
    api.put<{ data: Plant }>(`/settings/plants/${id}`, data).then((r) => r.data),
  createMachine: (
    plantId: string,
    data: {
      identifier: string;
      kwhRating: number;
      expectedOutputPerShift?: number;
    },
  ) =>
    api
      .post<{ data: Machine }>(`/settings/plants/${plantId}/machines`, data)
      .then((r) => r.data),
  updateMachine: (plantId: string, machineId: string, data: Partial<Machine>) =>
    api
      .put<{ data: Machine }>(
        `/settings/plants/${plantId}/machines/${machineId}`,
        data,
      )
      .then((r) => r.data),

  // Workers
  getWorkers: () =>
    api.get<{ data: Worker[] }>('/settings/workers').then((r) => r.data),
  createWorker: (data: {
    name: string;
    designation?: string;
    plantId?: string;
    shiftCostPaisa?: number;
  }) =>
    api.post<{ data: Worker }>('/settings/workers', data).then((r) => r.data),
  updateWorker: (id: string, data: Partial<Worker>) =>
    api.put<{ data: Worker }>(`/settings/workers/${id}`, data).then((r) => r.data),

  // System Settings
  getSystemSettings: () =>
    api.get<{ data: SystemSetting[] }>('/settings/system').then((r) => r.data),
  updateSystemSetting: (key: string, value: string) =>
    api
      .put<{ data: SystemSetting }>(`/settings/system/${key}`, { value })
      .then((r) => r.data),
};
