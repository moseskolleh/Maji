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
    totalPages?: number;
  };
}

// User types
export type UserRole = 'CITIZEN' | 'SCOUT' | 'VENDOR' | 'BUSINESS' | 'ADMIN';
export type Language = 'EN' | 'KRI';

export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
  language: Language;
  avatarUrl: string | null;
  reputation: number;
  isVerified: boolean;
  primaryZone: Zone | null;
  stats?: {
    ordersCount: number;
    reportsCount: number;
    alertsCount: number;
  };
  createdAt: string;
}

// Zone types
export interface Zone {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  centroid: GeoJSONPoint;
  waterSchedule: WaterSchedule | null;
  stats?: {
    usersCount: number;
    vendorsCount: number;
    activeAlerts: number;
  };
}

export interface WaterSchedule {
  days: string[];
  times: string[];
  reliability: number;
}

// GeoJSON types
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// Alert types
export type AlertType =
  | 'WATER_COMING'
  | 'WATER_ACTIVE'
  | 'WATER_ENDED'
  | 'SHORTAGE_WARNING'
  | 'FLOOD_WARNING'
  | 'TANKER_AVAILABLE';

export type AlertStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'VERIFIED';

export interface Alert {
  id: string;
  type: AlertType;
  message: string | null;
  zone: Zone;
  scout: {
    id: string;
    name: string | null;
    reputation: number;
  };
  eta: string | null;
  duration: number | null;
  confidence: number;
  isVerified: boolean;
  status: AlertStatus;
  createdAt: string;
}

// Vendor types
export interface Vendor {
  id: string;
  businessName: string;
  description: string | null;
  phone: string;
  location: GeoJSONPoint;
  address: string | null;
  distance?: number;
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  deliveryFee: number;
  minOrder: number;
  openingHours: Record<string, { open: string; close: string }> | null;
  products: Product[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  price: number;
  isAvailable: boolean;
}

// Order types
export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  vendor: {
    id: string;
    businessName: string;
    phone: string;
  };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryNotes: string | null;
  createdAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
}

export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Report types
export type ReportType =
  | 'LEAK'
  | 'BURST_PIPE'
  | 'CONTAMINATION'
  | 'BLOCKED_DRAIN'
  | 'FLOOD'
  | 'BROKEN_TAP'
  | 'OTHER';

export type ReportStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'FORWARDED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED';

export interface Report {
  id: string;
  type: ReportType;
  description: string | null;
  location: GeoJSONPoint;
  address: string | null;
  photoUrls: string[];
  status: ReportStatus;
  bountyAmount: number | null;
  bountyPaid: boolean;
  createdAt: string;
}

// Resource types
export type ResourceType =
  | 'WATER_TAP'
  | 'BOREHOLE'
  | 'WELL'
  | 'WATER_KIOSK'
  | 'SOLAR_CHARGER'
  | 'BATTERY_RENTAL'
  | 'WATER_VENDOR'
  | 'TANKER_STATION';

export type ResourceStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_REPAIR' | 'UNVERIFIED';

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  description: string | null;
  location: GeoJSONPoint;
  address: string | null;
  status: ResourceStatus;
  distance?: number;
  metadata: Record<string, unknown> | null;
  vendor?: {
    id: string;
    businessName: string;
    phone: string;
  };
}

// Navigation types
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneEntry: undefined;
  OtpVerify: { phone: string };
  SelectZone: undefined;
  ProfileSetup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  AlertDetail: { alertId: string };
  VendorList: undefined;
  VendorDetail: { vendorId: string };
  CreateOrder: { vendorId: string };
  Checkout: { orderId: string };
};
