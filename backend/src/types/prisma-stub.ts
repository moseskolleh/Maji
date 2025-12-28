// Stub types for testing when Prisma client isn't generated
// These mirror the schema.prisma definitions

export enum UserRole {
  CITIZEN = 'CITIZEN',
  SCOUT = 'SCOUT',
  VENDOR = 'VENDOR',
  BUSINESS = 'BUSINESS',
  ADMIN = 'ADMIN',
}

export enum Language {
  EN = 'EN',
  KRI = 'KRI',
}

export enum ResourceType {
  WATER_TAP = 'WATER_TAP',
  BOREHOLE = 'BOREHOLE',
  WELL = 'WELL',
  WATER_KIOSK = 'WATER_KIOSK',
  SOLAR_CHARGER = 'SOLAR_CHARGER',
  BATTERY_RENTAL = 'BATTERY_RENTAL',
  WATER_VENDOR = 'WATER_VENDOR',
  TANKER_STATION = 'TANKER_STATION',
}

export enum ResourceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNDER_REPAIR = 'UNDER_REPAIR',
  UNVERIFIED = 'UNVERIFIED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  ORANGE_MONEY = 'ORANGE_MONEY',
  AFRICELL_MONEY = 'AFRICELL_MONEY',
  CASH = 'CASH',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum EscrowStatus {
  NONE = 'NONE',
  HELD = 'HELD',
  RELEASED = 'RELEASED',
  REFUNDED = 'REFUNDED',
}

export enum AlertType {
  WATER_COMING = 'WATER_COMING',
  WATER_ACTIVE = 'WATER_ACTIVE',
  WATER_ENDED = 'WATER_ENDED',
  SHORTAGE_WARNING = 'SHORTAGE_WARNING',
  FLOOD_WARNING = 'FLOOD_WARNING',
  TANKER_AVAILABLE = 'TANKER_AVAILABLE',
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  VERIFIED = 'VERIFIED',
}

export enum ReportType {
  LEAK = 'LEAK',
  BURST_PIPE = 'BURST_PIPE',
  CONTAMINATION = 'CONTAMINATION',
  BLOCKED_DRAIN = 'BLOCKED_DRAIN',
  FLOOD = 'FLOOD',
  BROKEN_TAP = 'BROKEN_TAP',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FORWARDED = 'FORWARDED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum NotificationType {
  ALERT = 'ALERT',
  ORDER_UPDATE = 'ORDER_UPDATE',
  PAYMENT = 'PAYMENT',
  REPORT_UPDATE = 'REPORT_UPDATE',
  BOUNTY = 'BOUNTY',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  PUSH = 'PUSH',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

// User model
export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
  language: Language;
  avatarUrl: string | null;
  reputation: number;
  isVerified: boolean;
  isActive: boolean;
  fcmTokens: string[];
  primaryZoneId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// PrismaClient stub
export class PrismaClient {
  user: any;
  zone: any;
  vendor: any;
  product: any;
  order: any;
  orderItem: any;
  transaction: any;
  alert: any;
  report: any;
  resource: any;
  rating: any;
  notification: any;
  otpCode: any;
  refreshToken: any;

  constructor() {}
  $connect() { return Promise.resolve(); }
  $disconnect() { return Promise.resolve(); }
  $transaction(operations: any[]) { return Promise.all(operations); }
}
