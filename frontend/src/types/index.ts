export type Role =
  | 'SUPER_ADMIN'
  | 'FINANCE_HEAD'
  | 'PRODUCTION_HEAD'
  | 'LOGISTICS_HEAD'
  | 'MARKETING_HEAD';

export interface User {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
