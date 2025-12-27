import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';

// Extend FastifyRequest to include user info
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      phone: string;
      role: UserRole;
    };
  }
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// GeoJSON types
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Error codes
export const ErrorCodes = {
  // Auth errors (1xxx)
  INVALID_PHONE: 'E1001',
  INVALID_OTP: 'E1002',
  OTP_EXPIRED: 'E1003',
  OTP_MAX_ATTEMPTS: 'E1004',
  UNAUTHORIZED: 'E1005',
  FORBIDDEN: 'E1006',
  TOKEN_EXPIRED: 'E1007',
  INVALID_TOKEN: 'E1008',

  // User errors (2xxx)
  USER_NOT_FOUND: 'E2001',
  USER_INACTIVE: 'E2002',
  INVALID_ROLE: 'E2003',

  // Zone errors (3xxx)
  ZONE_NOT_FOUND: 'E3001',

  // Vendor errors (4xxx)
  VENDOR_NOT_FOUND: 'E4001',
  VENDOR_NOT_ACTIVE: 'E4002',
  VENDOR_NOT_VERIFIED: 'E4003',
  PRODUCT_NOT_FOUND: 'E4004',
  PRODUCT_UNAVAILABLE: 'E4005',

  // Order errors (5xxx)
  ORDER_NOT_FOUND: 'E5001',
  ORDER_INVALID_STATUS: 'E5002',
  ORDER_ALREADY_CANCELLED: 'E5003',
  INVALID_DELIVERY_ZONE: 'E5004',
  MIN_ORDER_NOT_MET: 'E5005',

  // Payment errors (6xxx)
  PAYMENT_FAILED: 'E6001',
  PAYMENT_PENDING: 'E6002',
  INVALID_PAYMENT_PROVIDER: 'E6003',
  ESCROW_NOT_HELD: 'E6004',

  // Alert errors (7xxx)
  ALERT_NOT_FOUND: 'E7001',
  SCOUT_NOT_VERIFIED: 'E7002',
  ALERT_EXPIRED: 'E7003',

  // Report errors (8xxx)
  REPORT_NOT_FOUND: 'E8001',
  DUPLICATE_REPORT: 'E8002',

  // Resource errors (9xxx)
  RESOURCE_NOT_FOUND: 'E9001',

  // General errors (0xxx)
  VALIDATION_ERROR: 'E0001',
  INTERNAL_ERROR: 'E0002',
  RATE_LIMITED: 'E0003',
  SERVICE_UNAVAILABLE: 'E0004',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// Route handler types
export type RouteHandler<T = unknown> = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<T>;
