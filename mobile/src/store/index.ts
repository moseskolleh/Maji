import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, Zone, Alert, Vendor, Order } from '../types';

// Auth slice
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.isLoading = false;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

// Zone slice
interface ZoneState {
  zones: Zone[];
  selectedZone: Zone | null;
  isLoading: boolean;
}

const initialZoneState: ZoneState = {
  zones: [],
  selectedZone: null,
  isLoading: false,
};

const zoneSlice = createSlice({
  name: 'zones',
  initialState: initialZoneState,
  reducers: {
    setZones: (state, action: PayloadAction<Zone[]>) => {
      state.zones = action.payload;
    },
    selectZone: (state, action: PayloadAction<Zone>) => {
      state.selectedZone = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

// Alerts slice
interface AlertsState {
  alerts: Alert[];
  isLoading: boolean;
  lastUpdated: string | null;
}

const initialAlertsState: AlertsState = {
  alerts: [],
  isLoading: false,
  lastUpdated: null,
};

const alertsSlice = createSlice({
  name: 'alerts',
  initialState: initialAlertsState,
  reducers: {
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.alerts = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    addAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.unshift(action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

// Vendors slice
interface VendorsState {
  vendors: Vendor[];
  isLoading: boolean;
}

const initialVendorsState: VendorsState = {
  vendors: [],
  isLoading: false,
};

const vendorsSlice = createSlice({
  name: 'vendors',
  initialState: initialVendorsState,
  reducers: {
    setVendors: (state, action: PayloadAction<Vendor[]>) => {
      state.vendors = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

// Orders slice
interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
}

const initialOrdersState: OrdersState = {
  orders: [],
  currentOrder: null,
  isLoading: false,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState: initialOrdersState,
  reducers: {
    setOrders: (state, action: PayloadAction<Order[]>) => {
      state.orders = action.payload;
    },
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
    },
    updateOrder: (state, action: PayloadAction<Order>) => {
      const index = state.orders.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = action.payload;
      }
      if (state.currentOrder?.id === action.payload.id) {
        state.currentOrder = action.payload;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

// Cart slice for ordering
interface CartItem {
  product: {
    id: string;
    name: string;
    unit: string;
    price: number;
  };
  quantity: number;
}

interface CartState {
  vendorId: string | null;
  items: CartItem[];
  deliveryAddress: string;
  deliveryNotes: string;
}

const initialCartState: CartState = {
  vendorId: null,
  items: [],
  deliveryAddress: '',
  deliveryNotes: '',
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: initialCartState,
  reducers: {
    setVendor: (state, action: PayloadAction<string>) => {
      if (state.vendorId !== action.payload) {
        state.vendorId = action.payload;
        state.items = [];
      }
    },
    addItem: (state, action: PayloadAction<CartItem>) => {
      const existingIndex = state.items.findIndex(
        (i) => i.product.id === action.payload.product.id
      );
      if (existingIndex !== -1) {
        state.items[existingIndex].quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }
    },
    updateQuantity: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const item = state.items.find((i) => i.product.id === action.payload.productId);
      if (item) {
        item.quantity = action.payload.quantity;
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.product.id !== action.payload);
    },
    setDeliveryAddress: (state, action: PayloadAction<string>) => {
      state.deliveryAddress = action.payload;
    },
    setDeliveryNotes: (state, action: PayloadAction<string>) => {
      state.deliveryNotes = action.payload;
    },
    clearCart: (state) => {
      state.vendorId = null;
      state.items = [];
      state.deliveryAddress = '';
      state.deliveryNotes = '';
    },
  },
});

// Configure store
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    zones: zoneSlice.reducer,
    alerts: alertsSlice.reducer,
    vendors: vendorsSlice.reducer,
    orders: ordersSlice.reducer,
    cart: cartSlice.reducer,
  },
});

// Export actions
export const authActions = authSlice.actions;
export const zoneActions = zoneSlice.actions;
export const alertsActions = alertsSlice.actions;
export const vendorsActions = vendorsSlice.actions;
export const ordersActions = ordersSlice.actions;
export const cartActions = cartSlice.actions;

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
