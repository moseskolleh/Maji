import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types';

// API configuration
const API_URL = __DEV__ ? 'http://localhost:3000/v1' : 'https://api.maji.app/v1';

// Storage keys
const TOKEN_KEY = '@maji/access_token';
const REFRESH_TOKEN_KEY = '@maji/refresh_token';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
export const setTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
};

export const getAccessToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(TOKEN_KEY);
};

export const getRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
};

export const clearTokens = async (): Promise<void> => {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
};

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // If unauthorized and we have a refresh token, try to refresh
    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = await getRefreshToken();

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data;
          await AsyncStorage.setItem(TOKEN_KEY, accessToken);

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens
          await clearTokens();
        }
      }
    }

    return Promise.reject(error);
  }
);

// API methods
export const authApi = {
  requestOtp: (phone: string) =>
    api.post<ApiResponse<{ expiresIn: number }>>('/auth/otp/request', { phone }),

  verifyOtp: (phone: string, otp: string) =>
    api.post<ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: { id: string; phone: string; name: string | null; role: string; isNewUser: boolean };
    }>>('/auth/otp/verify', { phone, otp }),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string; expiresIn: number }>>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    api.post<ApiResponse<{ message: string }>>('/auth/logout', { refreshToken }),
};

export const userApi = {
  getProfile: () => api.get<ApiResponse>('/users/me'),

  updateProfile: (data: { name?: string; language?: string; primaryZoneId?: string }) =>
    api.patch<ApiResponse>('/users/me', data),

  registerFcmToken: (token: string) =>
    api.post<ApiResponse>('/users/me/fcm-token', { token }),

  getNotifications: (page = 1, limit = 20) =>
    api.get<ApiResponse>(`/users/me/notifications?page=${page}&limit=${limit}`),
};

export const zoneApi = {
  getZones: (params?: { parentId?: string; search?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse>('/zones', { params }),

  getZone: (id: string) =>
    api.get<ApiResponse>(`/zones/${id}`),

  getZoneVendors: (id: string, page = 1, limit = 20) =>
    api.get<ApiResponse>(`/zones/${id}/vendors?page=${page}&limit=${limit}`),

  getZoneResources: (id: string, types?: string) =>
    api.get<ApiResponse>(`/zones/${id}/resources${types ? `?types=${types}` : ''}`),
};

export const alertApi = {
  getAlerts: (params?: { zoneId?: string; type?: string; status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse>('/alerts', { params }),

  getAlert: (id: string) =>
    api.get<ApiResponse>(`/alerts/${id}`),

  createAlert: (data: {
    zoneId: string;
    type: string;
    message?: string;
    eta?: string;
    duration?: number;
  }) => api.post<ApiResponse>('/alerts', data),

  submitFeedback: (id: string, data: {
    accurate: boolean;
    actualStartTime?: string;
    actualDuration?: number;
    comment?: string;
  }) => api.post<ApiResponse>(`/alerts/${id}/feedback`, data),
};

export const vendorApi = {
  getVendors: (params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    zoneId?: string;
    isOpen?: boolean;
    minRating?: number;
    sort?: 'distance' | 'rating' | 'price';
    page?: number;
    limit?: number;
  }) => api.get<ApiResponse>('/vendors', { params }),

  getVendor: (id: string) =>
    api.get<ApiResponse>(`/vendors/${id}`),
};

export const orderApi = {
  getOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse>('/orders', { params }),

  getOrder: (id: string) =>
    api.get<ApiResponse>(`/orders/${id}`),

  createOrder: (data: {
    vendorId: string;
    items: { productId: string; quantity: number }[];
    deliveryAddress: string;
    deliveryLocation?: { type: 'Point'; coordinates: [number, number] };
    deliveryNotes?: string;
  }) => api.post<ApiResponse>('/orders', data),

  confirmDelivery: (id: string) =>
    api.post<ApiResponse>(`/orders/${id}/confirm-delivery`, { confirmed: true }),

  cancelOrder: (id: string, reason?: string) =>
    api.post<ApiResponse>(`/orders/${id}/cancel`, { reason }),

  rateOrder: (id: string, data: {
    score: number;
    comment?: string;
    qualityScore?: number;
    serviceScore?: number;
  }) => api.post<ApiResponse>(`/orders/${id}/rate`, data),
};

export const paymentApi = {
  initiatePayment: (orderId: string, provider: 'ORANGE_MONEY' | 'AFRICELL_MONEY' | 'CASH', phone?: string) =>
    api.post<ApiResponse>('/payments/initiate', { orderId, provider, phone }),

  checkPaymentStatus: (id: string) =>
    api.get<ApiResponse>(`/payments/${id}/status`),
};

export const reportApi = {
  createReport: (data: {
    type: string;
    description?: string;
    location: { type: 'Point'; coordinates: [number, number] };
    address?: string;
    photoUrls?: string[];
  }) => api.post<ApiResponse>('/reports', data),

  getMyReports: (params?: { type?: string; status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse>('/reports/mine', { params }),

  getReport: (id: string) =>
    api.get<ApiResponse>(`/reports/${id}`),
};

export const resourceApi = {
  getResources: (params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    types?: string;
    status?: string;
    bbox?: string;
  }) => api.get<ApiResponse>('/resources', { params }),

  getResource: (id: string) =>
    api.get<ApiResponse>(`/resources/${id}`),

  createResource: (data: {
    type: string;
    name: string;
    description?: string;
    location: { type: 'Point'; coordinates: [number, number] };
    address?: string;
    zoneId: string;
    metadata?: Record<string, unknown>;
  }) => api.post<ApiResponse>('/resources', data),
};

export default api;
