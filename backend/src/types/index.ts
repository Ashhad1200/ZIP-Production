import { Role, Shift, GatePassStatus, OrderStatus, ApprovalStatus, PaymentMode, PurchaseSource } from '@prisma/client';
import { Request } from 'express';

// Authenticated request with user info from JWT
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: Role;
    name: string;
  };
}

// Standard API response wrapper
export interface ApiResponse<T> {
  data: T;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Pagination query params
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Error response
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Currency display pair
export interface CurrencyDisplay {
  amountPaisa: bigint;
  amountDisplay: string;
}

// Trend data for KPI cards
export interface TrendData {
  value: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  comparedTo: string;
}

// Date range filter
export interface DateRangeFilter {
  dateFrom?: string;
  dateTo?: string;
}

// Common entity reference (for embedded objects)
export interface EntityRef {
  id: string;
  name: string;
}

export interface VariantRef extends EntityRef {
  code: string;
}

// JWT payload
export interface JwtPayload {
  userId: string;
  role: Role;
  name: string;
  iat?: number;
  exp?: number;
}
