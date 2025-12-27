import { FastifyReply } from 'fastify';
import { ErrorCodes, ErrorCode } from '../types/index.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Pre-defined error factories
export const Errors = {
  // Auth
  invalidPhone: () =>
    new AppError('Invalid phone number format', 400, ErrorCodes.INVALID_PHONE),
  invalidOtp: () =>
    new AppError('Invalid or expired OTP', 400, ErrorCodes.INVALID_OTP),
  otpExpired: () =>
    new AppError('OTP has expired', 400, ErrorCodes.OTP_EXPIRED),
  otpMaxAttempts: () =>
    new AppError('Maximum OTP attempts exceeded', 429, ErrorCodes.OTP_MAX_ATTEMPTS),
  unauthorized: () =>
    new AppError('Authentication required', 401, ErrorCodes.UNAUTHORIZED),
  forbidden: (message = 'Access denied') =>
    new AppError(message, 403, ErrorCodes.FORBIDDEN),
  tokenExpired: () =>
    new AppError('Token has expired', 401, ErrorCodes.TOKEN_EXPIRED),
  invalidToken: () =>
    new AppError('Invalid token', 401, ErrorCodes.INVALID_TOKEN),

  // User
  userNotFound: () =>
    new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND),
  userInactive: () =>
    new AppError('User account is inactive', 403, ErrorCodes.USER_INACTIVE),

  // Zone
  zoneNotFound: () =>
    new AppError('Zone not found', 404, ErrorCodes.ZONE_NOT_FOUND),

  // Vendor
  vendorNotFound: () =>
    new AppError('Vendor not found', 404, ErrorCodes.VENDOR_NOT_FOUND),
  vendorNotActive: () =>
    new AppError('Vendor is not active', 400, ErrorCodes.VENDOR_NOT_ACTIVE),
  productNotFound: () =>
    new AppError('Product not found', 404, ErrorCodes.PRODUCT_NOT_FOUND),
  productUnavailable: () =>
    new AppError('Product is not available', 400, ErrorCodes.PRODUCT_UNAVAILABLE),

  // Order
  orderNotFound: () =>
    new AppError('Order not found', 404, ErrorCodes.ORDER_NOT_FOUND),
  orderInvalidStatus: (current: string, expected: string) =>
    new AppError(
      `Invalid order status. Current: ${current}, Expected: ${expected}`,
      400,
      ErrorCodes.ORDER_INVALID_STATUS
    ),
  invalidDeliveryZone: () =>
    new AppError('Delivery address is outside vendor delivery zones', 400, ErrorCodes.INVALID_DELIVERY_ZONE),
  minOrderNotMet: (minOrder: number) =>
    new AppError(`Minimum order amount is ${minOrder} Leones`, 400, ErrorCodes.MIN_ORDER_NOT_MET),

  // Payment
  paymentFailed: (message = 'Payment failed') =>
    new AppError(message, 400, ErrorCodes.PAYMENT_FAILED),
  invalidPaymentProvider: () =>
    new AppError('Invalid payment provider', 400, ErrorCodes.INVALID_PAYMENT_PROVIDER),

  // Alert
  alertNotFound: () =>
    new AppError('Alert not found', 404, ErrorCodes.ALERT_NOT_FOUND),
  scoutNotVerified: () =>
    new AppError('Only verified scouts can post alerts', 403, ErrorCodes.SCOUT_NOT_VERIFIED),

  // Report
  reportNotFound: () =>
    new AppError('Report not found', 404, ErrorCodes.REPORT_NOT_FOUND),

  // Resource
  resourceNotFound: () =>
    new AppError('Resource not found', 404, ErrorCodes.RESOURCE_NOT_FOUND),

  // General
  validation: (details: unknown) =>
    new AppError('Validation error', 400, ErrorCodes.VALIDATION_ERROR, details),
  internal: (message = 'Internal server error') =>
    new AppError(message, 500, ErrorCodes.INTERNAL_ERROR),
  rateLimited: () =>
    new AppError('Too many requests', 429, ErrorCodes.RATE_LIMITED),
};

// Error response helper
export function sendError(reply: FastifyReply, error: AppError | Error): void {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  } else {
    // Generic error
    console.error('Unexpected error:', error);
    reply.status(500).send({
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    });
  }
}
