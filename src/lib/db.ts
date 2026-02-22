import { User, Laundromat, Order, Payment, OrderWithDetails, Service, RECOMMENDED_SERVICES, calculateDistance } from './types';

const DB_KEY = 'laundry_app_db';

interface Database {
  users: User[];
  laundromats: Laundromat[];
  services: Service[];
  orders: Order[];
  payments: Payment[];
}

const defaultDb: Database = {
  users: [],
  laundromats: [],
  services: [],
  orders: [],
  payments: []
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
