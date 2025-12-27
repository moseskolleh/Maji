import { GeoJSONPoint } from '../types/index.js';

/**
 * Generate a random OTP code
 */
export function generateOtp(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

/**
 * Validate Sierra Leone phone number
 * Valid formats: +23276123456, 23276123456, 076123456, 76123456
 */
export function validatePhone(phone: string): boolean {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Sierra Leone phone patterns
  const patterns = [
    /^\+232[0-9]{8}$/,      // +23276123456
    /^232[0-9]{8}$/,        // 23276123456
    /^0[0-9]{8}$/,          // 076123456
    /^[0-9]{8}$/,           // 76123456
  ];

  return patterns.some(pattern => pattern.test(cleaned));
}

/**
 * Normalize phone number to international format (+232XXXXXXXX)
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/[^\d]/g, '');

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // Add country code if missing
  if (!cleaned.startsWith('232')) {
    cleaned = '232' + cleaned;
  }

  return '+' + cleaned;
}

/**
 * Generate order number
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `MJ-${year}-${random}`;
}

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in meters
 */
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Create GeoJSON Point from coordinates
 */
export function createGeoPoint(lng: number, lat: number): GeoJSONPoint {
  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
}

/**
 * Extract coordinates from GeoJSON Point
 */
export function extractCoordinates(point: GeoJSONPoint): { lng: number; lat: number } {
  return {
    lng: point.coordinates[0],
    lat: point.coordinates[1],
  };
}

/**
 * Calculate platform fee
 */
export function calculatePlatformFee(
  subtotal: number,
  feePercentage: number = 0.05,
  minFee: number = 500,
  maxFee: number = 50000
): number {
  const calculatedFee = Math.round(subtotal * feePercentage);
  return Math.max(minFee, Math.min(maxFee, calculatedFee));
}

/**
 * Format currency (Sierra Leonean Leone)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-SL', {
    style: 'currency',
    currency: 'SLL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Slugify text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Calculate confidence score based on scout reputation
 */
export function calculateConfidence(scoutReputation: number): number {
  // Base confidence of 0.5, increases with reputation
  // Max confidence of 0.95 at 1000+ reputation
  const baseConfidence = 0.5;
  const maxBonus = 0.45;
  const maxReputation = 1000;

  const bonus = Math.min(scoutReputation / maxReputation, 1) * maxBonus;
  return Math.round((baseConfidence + bonus) * 100) / 100;
}

/**
 * Check if a point is within a bounding box
 */
export function isPointInBbox(
  point: { lat: number; lng: number },
  bbox: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return (
    point.lng >= minLng &&
    point.lng <= maxLng &&
    point.lat >= minLat &&
    point.lat <= maxLat
  );
}

/**
 * Paginate array
 */
export function paginate<T>(
  items: T[],
  page: number = 1,
  limit: number = 20
): { data: T[]; total: number; page: number; limit: number; totalPages: number } {
  const start = (page - 1) * limit;
  const end = start + limit;
  const data = items.slice(start, end);
  const totalPages = Math.ceil(items.length / limit);

  return {
    data,
    total: items.length,
    page,
    limit,
    totalPages,
  };
}
