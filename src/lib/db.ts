import { User, Laundromat, Order, Payment, OrderWithDetails, Service, PromoCode, Subscription, Notification, RECOMMENDED_SERVICES, calculateDistance, calculateDiscount } from './types';

const DB_KEY = 'laundry_app_db';

interface Database {
  users: User[];
  laundromats: Laundromat[];
  services: Service[];
  orders: Order[];
  payments: Payment[];
  promoCodes: PromoCode[];
  subscriptions: Subscription[];
  notifications: Notification[];
}

const defaultDb: Database = {
  users: [],
  laundromats: [],
  services: [],
  orders: [],
  payments: [],
  promoCodes: [],
  subscriptions: [],
  notifications: []
};

function getDb(): Database {
  if (typeof window === 'undefined') return defaultDb;
  const data = localStorage.getItem(DB_KEY);
  return data ? JSON.parse(data) : defaultDb;
}

function saveDb(db: Database): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateQRCode(): string {
  return 'qr_' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export const db = {
  users: {
    getAll: (): User[] => getDb().users,
    getById: (id: string): User | undefined => getDb().users.find(u => u.id === id),
    getByEmail: (email: string): User | undefined => getDb().users.find(u => u.email === email),
    create: (user: Omit<User, 'id' | 'createdAt'>): User => {
      const db = getDb();
      const newUser: User = { ...user, id: generateId(), createdAt: new Date().toISOString() };
      db.users.push(newUser);
      saveDb(db);
      return newUser;
    },
    update: (id: string, updates: Partial<User>): User | undefined => {
      const db = getDb();
      const index = db.users.findIndex(u => u.id === id);
      if (index === -1) return undefined;
      db.users[index] = { ...db.users[index], ...updates };
      saveDb(db);
      return db.users[index];
    }
  },

  laundromats: {
    getAll: (): Laundromat[] => getDb().laundromats,
    getById: (id: string): Laundromat | undefined => getDb().laundromats.find(l => l.id === id),
    getActive: (): Laundromat[] => getDb().laundromats.filter(l => l.isActive),
    create: (laundromat: Omit<Laundromat, 'id' | 'qrCode' | 'createdAt'>): Laundromat => {
      const db = getDb();
      const newLaundromat: Laundromat = {
        ...laundromat,
        id: generateId(),
        qrCode: generateQRCode(),
        createdAt: new Date().toISOString()
      };
      db.laundromats.push(newLaundromat);
      saveDb(db);
      return newLaundromat;
    },
    update: (id: string, updates: Partial<Laundromat>): Laundromat | undefined => {
      const db = getDb();
      const index = db.laundromats.findIndex(l => l.id === id);
      if (index === -1) return undefined;
      db.laundromats[index] = { ...db.laundromats[index], ...updates };
      saveDb(db);
      return db.laundromats[index];
    },
    delete: (id: string): boolean => {
      const db = getDb();
      const index = db.laundromats.findIndex(l => l.id === id);
      if (index === -1) return false;
      db.laundromats.splice(index, 1);
      saveDb(db);
      return true;
    },
    findNearest: (lat: number, lon: number): Laundromat | undefined => {
      const active = getDb().laundromats.filter(l => l.isActive);
      let nearest: Laundromat | undefined;
      let minDistance = Infinity;

      for (const l of active) {
        const dist = calculateDistance(lat, lon, l.latitude, l.longitude);
        if (dist <= l.deliveryRadius && dist < minDistance) {
          minDistance = dist;
          nearest = l;
        }
      }
      return nearest;
    }
  },

  services: {
    getAll: (): Service[] => getDb().services,
    getById: (id: string): Service | undefined => getDb().services.find(s => s.id === id),
    getByLaundromat: (laundromatId: string): Service[] =>
      getDb().services.filter(s => s.laundromatId === laundromatId && s.isActive),
    getActiveByLaundromat: (laundromatId: string): Service[] =>
      getDb().services.filter(s => s.laundromatId === laundromatId && s.isActive),
    create: (service: Omit<Service, 'id' | 'createdAt'>): Service => {
      const db = getDb();
      const newService: Service = { ...service, id: generateId(), createdAt: new Date().toISOString() };
      db.services.push(newService);
      saveDb(db);
      return newService;
    },
    update: (id: string, updates: Partial<Service>): Service | undefined => {
      const db = getDb();
      const index = db.services.findIndex(s => s.id === id);
      if (index === -1) return undefined;
      db.services[index] = { ...db.services[index], ...updates };
      saveDb(db);
      return db.services[index];
    },
    delete: (id: string): boolean => {
      const db = getDb();
      const index = db.services.findIndex(s => s.id === id);
      if (index === -1) return false;
      db.services.splice(index, 1);
      saveDb(db);
      return true;
    },
    createDefaultsForLaundromat: (laundromatId: string): Service[] => {
      const created: Service[] = [];
      for (const rec of RECOMMENDED_SERVICES) {
        const service = db.services.create({
          laundromatId,
          name: rec.name,
          description: rec.description,
          price: rec.recommendedPrice,
          recommendedPrice: rec.recommendedPrice,
          isActive: true
        });
        created.push(service);
      }
      return created;
    }
  },

  orders: {
    getAll: (): Order[] => getDb().orders,
    getById: (id: string): Order | undefined => getDb().orders.find(o => o.id === id),
    getByCustomer: (customerId: string): Order[] => getDb().orders.filter(o => o.customerId === customerId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getByLaundromat: (laundromatId: string): Order[] => getDb().orders.filter(o => o.laundromatId === laundromatId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getByDriver: (driverId: string): Order[] => getDb().orders.filter(o => o.driverId === driverId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getAvailableForDriver: (): Order[] => getDb().orders.filter(o => o.status === 'pending' && !o.driverId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    create: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Order => {
      const db = getDb();
      const now = new Date().toISOString();
      const newOrder: Order = { ...order, id: generateId(), createdAt: now, updatedAt: now };
      db.orders.push(newOrder);
      saveDb(db);
      return newOrder;
    },
    update: (id: string, updates: Partial<Order>): Order | undefined => {
      const db = getDb();
      const index = db.orders.findIndex(o => o.id === id);
      if (index === -1) return undefined;
      db.orders[index] = { ...db.orders[index], ...updates, updatedAt: new Date().toISOString() };
      saveDb(db);
      return db.orders[index];
    },
    withDetails: (order: Order): OrderWithDetails => {
      const db = getDb();
      return {
        ...order,
        customer: db.users.find(u => u.id === order.customerId)!,
        laundromat: db.laundromats.find(l => l.id === order.laundromatId)!,
        driver: db.users.find(u => u.id === order.driverId)
      };
    }
  },

  payments: {
    getAll: (): Payment[] => getDb().payments,
    getByOrder: (orderId: string): Payment | undefined => getDb().payments.find(p => p.orderId === orderId),
    create: (payment: Omit<Payment, 'id' | 'createdAt'>): Payment => {
      const db = getDb();
      const newPayment: Payment = { ...payment, id: generateId(), createdAt: new Date().toISOString() };
      db.payments.push(newPayment);
      saveDb(db);
      return newPayment;
    },
    update: (id: string, updates: Partial<Payment>): Payment | undefined => {
      const db = getDb();
      const index = db.payments.findIndex(p => p.id === id);
      if (index === -1) return undefined;
      db.payments[index] = { ...db.payments[index], ...updates };
      saveDb(db);
      return db.payments[index];
    }
  },

  promoCodes: {
    getAll: (): PromoCode[] => getDb().promoCodes,
    getById: (id: string): PromoCode | undefined => getDb().promoCodes.find(p => p.id === id),
    getByCode: (code: string): PromoCode | undefined => getDb().promoCodes.find(p => p.code.toUpperCase() === code.toUpperCase() && p.isActive),
    create: (promoCode: Omit<PromoCode, 'id' | 'createdAt' | 'usageCount'>): PromoCode => {
      const db = getDb();
      const newPromoCode: PromoCode = { ...promoCode, id: generateId(), usageCount: 0, createdAt: new Date().toISOString() };
      db.promoCodes.push(newPromoCode);
      saveDb(db);
      return newPromoCode;
    },
    update: (id: string, updates: Partial<PromoCode>): PromoCode | undefined => {
      const db = getDb();
      const index = db.promoCodes.findIndex(p => p.id === id);
      if (index === -1) return undefined;
      db.promoCodes[index] = { ...db.promoCodes[index], ...updates };
      saveDb(db);
      return db.promoCodes[index];
    },
    validate: (code: string): { valid: boolean; promoCode?: PromoCode; message?: string } => {
      const promoCode = db.promoCodes.getByCode(code);
      if (!promoCode) return { valid: false, message: 'Invalid promo code' };
      
      const now = new Date();
      if (new Date(promoCode.validFrom) > now) return { valid: false, message: 'Promo code not yet active' };
      if (new Date(promoCode.validUntil) < now) return { valid: false, message: 'Promo code expired' };
      if (promoCode.usageCount >= promoCode.usageLimit) return { valid: false, message: 'Promo code usage limit reached' };
      
      return { valid: true, promoCode };
    },
    apply: (code: string, amount: number): { success: boolean; discount: number; finalAmount: number; message?: string } => {
      const validation = db.promoCodes.validate(code);
      if (!validation.valid) return { success: false, discount: 0, finalAmount: amount, message: validation.message };
      
      const promoCode = validation.promoCode!;
      const discount = calculateDiscount(amount, promoCode.discountPercent, promoCode.maxDiscount);
      
      db.promoCodes.update(promoCode.id, { usageCount: promoCode.usageCount + 1 });
      
      return { success: true, discount, finalAmount: amount - discount };
    }
  },

  subscriptions: {
    getAll: (): Subscription[] => getDb().subscriptions,
    getById: (id: string): Subscription | undefined => getDb().subscriptions.find(s => s.id === id),
    getByCustomer: (customerId: string): Subscription[] => getDb().subscriptions.filter(s => s.customerId === customerId && s.isActive),
    getByLaundromat: (laundromatId: string): Subscription[] => getDb().subscriptions.filter(s => s.laundromatId === laundromatId && s.isActive),
    create: (subscription: Omit<Subscription, 'id' | 'createdAt'>): Subscription => {
      const db = getDb();
      const newSubscription: Subscription = { ...subscription, id: generateId(), createdAt: new Date().toISOString() };
      db.subscriptions.push(newSubscription);
      saveDb(db);
      return newSubscription;
    },
    update: (id: string, updates: Partial<Subscription>): Subscription | undefined => {
      const db = getDb();
      const index = db.subscriptions.findIndex(s => s.id === id);
      if (index === -1) return undefined;
      db.subscriptions[index] = { ...db.subscriptions[index], ...updates };
      saveDb(db);
      return db.subscriptions[index];
    },
    cancel: (id: string): boolean => {
      const db = getDb();
      const index = db.subscriptions.findIndex(s => s.id === id);
      if (index === -1) return false;
      db.subscriptions[index].isActive = false;
      saveDb(db);
      return true;
    }
  },

  notifications: {
    getAll: (): Notification[] => getDb().notifications,
    getByUser: (userId: string): Notification[] => getDb().notifications.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getUnreadByUser: (userId: string): Notification[] => getDb().notifications.filter(n => n.userId === userId && !n.isRead).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    create: (notification: Omit<Notification, 'id' | 'createdAt'>): Notification => {
      const db = getDb();
      const newNotification: Notification = { ...notification, id: generateId(), createdAt: new Date().toISOString() };
      db.notifications.push(newNotification);
      saveDb(db);
      return newNotification;
    },
    markAsRead: (id: string): Notification | undefined => {
      const db = getDb();
      const index = db.notifications.findIndex(n => n.id === id);
      if (index === -1) return undefined;
      db.notifications[index].isRead = true;
      saveDb(db);
      return db.notifications[index];
    },
    markAllAsRead: (userId: string): void => {
      const db = getDb();
      db.notifications.forEach(n => {
        if (n.userId === userId) n.isRead = true;
      });
      saveDb(db);
    },
    createOrderStatusNotification: (userId: string, orderId: string, status: string) => {
      const statusMessages: Record<string, string> = {
        pending: 'Your order has been received and is pending pickup',
        picked_up: 'Your laundry has been picked up',
        in_progress: 'Your laundry is being processed',
        delivered: 'Your laundry has been delivered!',
        cancelled: 'Your order has been cancelled'
      };
      
      db.notifications.create({
        userId,
        orderId,
        type: 'order_status',
        title: 'Order Update',
        message: statusMessages[status] || 'Your order status has been updated',
        isRead: false
      });
    }
  },

  init: () => {
    const db = getDb();
    if (db.users.length === 0) {
      db.users.push({
        id: 'admin',
        email: 'admin@laundryapp.com',
        name: 'Admin',
        phone: '',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      saveDb(db);
    }
  }
};
