// Environment configuration for Maji backend

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  apiUrl: process.env.API_URL || 'http://localhost:3000',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // OTP
  otp: {
    expiresIn: parseInt(process.env.OTP_EXPIRES_IN || '300', 10), // 5 minutes
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    maxAttempts: 3,
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // SMS - Africa's Talking
  sms: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || 'sandbox',
    senderId: process.env.AT_SENDER_ID || 'MAJI',
  },

  // Push Notifications - Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },

  // Mobile Money - Orange Money
  orangeMoney: {
    clientId: process.env.ORANGE_CLIENT_ID,
    clientSecret: process.env.ORANGE_CLIENT_SECRET,
    merchantCode: process.env.ORANGE_MERCHANT_CODE,
    baseUrl: process.env.ORANGE_BASE_URL || 'https://api.orange.com/orange-money-webpay/sl/v1',
    authUrl: 'https://api.orange.com/oauth/v3/token',
  },

  // Mobile Money - Africell
  africell: {
    apiKey: process.env.AFRICELL_API_KEY,
    merchantId: process.env.AFRICELL_MERCHANT_ID,
    baseUrl: process.env.AFRICELL_BASE_URL || 'https://api.africellmoney.com/v1',
  },

  // Maps - Mapbox
  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN,
  },

  // Media Storage - Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
  },

  // Platform fees
  platform: {
    feePercentage: 0.05, // 5% platform fee
    minFee: 500, // 500 Leones minimum
    maxFee: 50000, // 50,000 Leones maximum
  },

  // Reputation
  reputation: {
    alertPoints: 10,
    verifiedAlertBonus: 20,
    reportPoints: 5,
    verifiedReportBonus: 15,
    ratingPoints: 2,
  },

  // Bounty amounts (in Leones)
  bounty: {
    leak: 20000,
    burstPipe: 30000,
    contamination: 25000,
    blockedDrain: 15000,
    flood: 20000,
    brokenTap: 10000,
    other: 5000,
  },
} as const;

export type Config = typeof config;
