export type UserRole = 'customer' | 'laundromat_staff' | 'driver' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  laundromatId?: string;
  createdAt: string;
}

export interface Laundromat {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadius: number;
  qrCode: string;
  phone: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'picked_up' | 'in_progress' | 'delivered' | 'cancelled';

export interface Service {
  id: string;
  laundromatId: string;
  name: string;
  description: string;
  price: number;
  recommendedPrice: number;
  isActive: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  laundromatId: string;
  driverId?: string;
  status: OrderStatus;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  scheduledPickup: string;
  serviceId: string;
  serviceName: string;
  notes?: string;
  price: number;
  platformFee: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  platformFee: number;
  laundromatPayout: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface OrderWithDetails extends Order {
  customer: User;
  laundromat: Laundromat;
  driver?: User;
}

export const PLATFORM_FEE_PERCENT = 15;

export const RECOMMENDED_SERVICES = [
  {
    name: 'Wash & Fold',
    description: 'Standard wash and fold service per bag',
    recommendedPrice: 25
  },
  {
    name: 'Dry Cleaning',
    description: 'Professional dry cleaning service',
    recommendedPrice: 45
  },
  {
    name: 'Wash & Press',
    description: 'Wash and press shirts',
    recommendedPrice: 35
  },
  {
    name: 'Bedding & Linens',
    description: 'Wash and dry bedding, sheets, and linens',
    recommendedPrice: 55
  },
  {
    name: 'Express Service',
    description: 'Same day delivery service',
    recommendedPrice: 65
  }
];

export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
