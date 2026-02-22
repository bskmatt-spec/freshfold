'use client';

import { useEffect, useState, useCallback } from 'react';
import { authClient, useSession } from '@/lib/auth/client';
import {
  getLaundromatById, getOrdersByLaundromat, getAvailableOrdersForDriver,
  getDriversByLaundromat, getServicesByLaundromat, createDefaultServices,
  createService, updateService, deleteService as deleteServiceAction,
  updateOrder, createOrderStatusNotification,
  getNotificationsByUser, getUnreadNotificationsByUser, markNotificationRead,
  getSubscriptionsByLaundromat, getServiceById, getUserById, updateUser,
} from '@/lib/actions';
import { RECOMMENDED_SERVICES } from '@/lib/types';
import type { Order, Laundromat, Service, Notification, Subscription, User } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Package, Truck, CheckCircle, Clock, MapPin, User as UserIcon, Store,
  QrCode, DollarSign, Plus, Edit, Trash2, Sparkles, Bell, X, FileText, RefreshCw, Eye, EyeOff, CreditCard,
} from 'lucide-react';

export default function LaundromatPortal() {
  const { data: session, isPending, refetch: refetchSession } = useSession();

  // Auth form
  const [authForm, setAuthForm] = useState({ email: '', password: '', laundromatId: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  // Portal state
  const [laundromat, setLaundromat] = useState<Laundromat | null>(null);
  const [laundromatIdInput, setLaundromatIdInput] = useState('');
  const [laundromatError, setLaundromatError] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subCustomers, setSubCustomers] = useState<Record<string, User | null>>({});
  const [subServices, setSubServices] = useState<Record<string, Service | null>>({});
  const [activeTab, setActiveTab] = useState('orders');
  const [showQR, setShowQR] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', price: '', useTemplate: '' });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [orderCustomers, setOrderCustomers] = useState<Record<string, User | null>>({});
  const [stripeConnecting, setStripeConnecting] = useState(false);

  const loadData = useCallback(async (lId: string, userId: string) => {
    const [lOrders, avail, driverList, svcs, notifs, unread, subs] = await Promise.all([
      getOrdersByLaundromat(lId),
      getAvailableOrdersForDriver(lId),
      getDriversByLaundromat(lId),
      getServicesByLaundromat(lId),
      getNotificationsByUser(userId),
      getUnreadNotificationsByUser(userId),
      getSubscriptionsByLaundromat(lId),
    ]);
    setOrders(lOrders);
    setAvailableOrders(avail);
    setDrivers(driverList);
    setServices(svcs.length > 0 ? svcs : await createDefaultServices(lId));
    setNotifications(notifs);
    setUnreadCount(unread.length);
    setSubscriptions(subs);

    // Resolve customer names for orders
    const customerIds = [...new Set(lOrders.map(o => o.customerId))];
    const customers: Record<string, User | null> = {};
    await Promise.all(customerIds.map(async id => {
      customers[id] = await getUserById(id);
    }));
    setOrderCustomers(customers);

    // Resolve sub customers + services
    const subCustomerIds = [...new Set(subs.map(s => s.customerId))];
    const subSvcIds = [...new Set(subs.map(s => s.serviceId))];
    const subCusts: Record<string, User | null> = {};
    const subSvcs: Record<string, Service | null> = {};
    await Promise.all([
      ...subCustomerIds.map(async id => { subCusts[id] = await getUserById(id); }),
      ...subSvcIds.map(async id => { subSvcs[id] = await getServiceById(id); }),
    ]);
    setSubCustomers(subCusts);
    setSubServices(subSvcs);
  }, []);

  // Load data when session + laundromat are ready
  useEffect(() => {
    if (!isPending && session?.user && laundromat) {
      loadData(laundromat.id, session.user.id);
    }
  }, [session, isPending, laundromat, loadData]);

  // Restore laundromat from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('laundromat_portal_id');
    if (saved) {
      getLaundromatById(saved).then(l => { if (l) setLaundromat(l); });
    }
  }, []);

  // ── AUTH ──────────────────────────────────────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError('');
    const { error } = await authClient.signIn.email({
      email: authForm.email, password: authForm.password,
    });
    if (error) {
      setAuthError(error.message ?? 'Invalid credentials');
      setAuthLoading(false);
    } else {
      await refetchSession();
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError('');
    const { error } = await authClient.signUp.email({
      name: 'Staff Member', email: authForm.email, password: authForm.password,
    });
    if (error) {
      setAuthError(error.message ?? 'Sign up failed');
      setAuthLoading(false);
    } else {
      await refetchSession();
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    localStorage.removeItem('bearer_token');
    localStorage.removeItem('laundromat_portal_id');
    setLaundromat(null);
    await refetchSession();
  };

  const handleConnectLaundromat = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaundromatError('');
    const l = await getLaundromatById(laundromatIdInput.trim());
    if (!l) { setLaundromatError('Invalid laundromat ID'); return; }
    // Set role to laundromat_staff if needed
    if (session?.user && session.user.role === 'customer') {
      await updateUser(session.user.id, { role: 'laundromat_staff', laundromatId: l.id });
    }
    localStorage.setItem('laundromat_portal_id', l.id);
    setLaundromat(l);
  };

  const handleConnectStripe = async () => {
    if (!laundromat) return;
    setStripeConnecting(true);
    try {
      const res = await fetch(`/api/stripe/connect?laundromatId=${laundromat.id}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Failed to start Stripe onboarding');
      }
    } catch {
      alert('Failed to connect to Stripe');
    } finally {
      setStripeConnecting(false);
    }
  };

  // ── ORDER ACTIONS ─────────────────────────────────────────────────────────

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || !laundromat || !session?.user) return;
    await updateOrder(orderId, { status });
    await createOrderStatusNotification(order.customerId, orderId, status);
    await loadData(laundromat.id, session.user.id);
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    if (!laundromat || !session?.user) return;
    await updateOrder(orderId, { driverId, status: 'picked_up' });
    await loadData(laundromat.id, session.user.id);
  };

  const acceptOrder = async (orderId: string) => {
    if (!laundromat || !session?.user) return;
    await updateOrder(orderId, { driverId: session.user.id, status: 'picked_up' });
    await loadData(laundromat.id, session.user.id);
  };

  // ── SERVICE ACTIONS ───────────────────────────────────────────────────────

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !laundromat || !session?.user) return;
    await updateService(editingService.id, {
      name: editingService.name,
      description: editingService.description,
      price: editingService.price,
    });
    setEditingService(null);
    await loadData(laundromat.id, session.user.id);
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laundromat || !session?.user) return;
    const template = RECOMMENDED_SERVICES.find(t => t.name === newService.useTemplate);
    await createService({
      laundromatId: laundromat.id,
      name: template ? template.name : newService.name,
      description: template ? template.description : newService.description,
      price: parseFloat(newService.price) || (template ? template.recommendedPrice : 0),
      recommendedPrice: template ? template.recommendedPrice : (parseFloat(newService.price) || 0),
      isActive: true,
    });
    setNewService({ name: '', description: '', price: '', useTemplate: '' });
    setShowAddService(false);
    await loadData(laundromat.id, session.user.id);
  };

  const toggleServiceStatus = async (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc || !laundromat || !session?.user) return;
    await updateService(serviceId, { isActive: !svc.isActive });
    await loadData(laundromat.id, session.user.id);
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Delete this service?') || !laundromat || !session?.user) return;
    await deleteServiceAction(serviceId);
    await loadData(laundromat.id, session.user.id);
  };

  const handleMarkNotifRead = async (id: string) => {
    await markNotificationRead(id);
    if (laundromat && session?.user) await loadData(laundromat.id, session.user.id);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'picked_up': return <Truck className="h-4 w-4 text-blue-500" />;
      case 'in_progress': return <Package className="h-4 w-4 text-purple-500" />;
      case 'delivered': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending', picked_up: 'Picked Up',
      in_progress: 'In Progress', delivered: 'Delivered', cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
  };

  // ── LOADING ───────────────────────────────────────────────────────────────

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-indigo-500 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Store className="h-6 w-6 text-white" />
          </div>
          <p className="text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  // ── AUTH SCREEN ───────────────────────────────────────────────────────────

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-md pt-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
                <Store className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Laundromat Portal</CardTitle>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setAuthTab('signin')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authTab === 'signin' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  Sign In
                </button>
                <button onClick={() => setAuthTab('signup')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authTab === 'signup' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  Create Account
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {authTab === 'signin' ? (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="staff@laundromat.com" required />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? 'text' : 'password'} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" required className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {authError && <p className="text-sm text-red-500">{authError}</p>}
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? 'Signing in…' : 'Sign In'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="staff@laundromat.com" required />
                  </div>
                  <div>
                    <Label htmlFor="su-password">Password</Label>
                    <div className="relative">
                      <Input id="su-password" type={showPassword ? 'text' : 'password'} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" required minLength={8} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {authError && <p className="text-sm text-red-500">{authError}</p>}
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? 'Creating account…' : 'Create Account'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── LAUNDROMAT CONNECT SCREEN ─────────────────────────────────────────────

  if (!laundromat) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-md pt-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
                <Store className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl">Connect Your Laundromat</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Signed in as {session.user.email}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConnectLaundromat} className="space-y-4">
                <div>
                  <Label htmlFor="laundromatId">Laundromat ID</Label>
                  <Input
                    id="laundromatId"
                    value={laundromatIdInput}
                    onChange={(e) => setLaundromatIdInput(e.target.value)}
                    placeholder="Enter laundromat ID from admin panel"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Get this from your Admin Dashboard → Laundromats tab</p>
                </div>
                {laundromatError && <p className="text-sm text-red-500">{laundromatError}</p>}
                <Button type="submit" className="w-full">Connect</Button>
              </form>
              <Button variant="ghost" className="w-full mt-2" onClick={handleSignOut}>Sign Out</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── MAIN PORTAL ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold">{laundromat.name}</h1>
              <p className="text-sm text-gray-500">{session.user.role === 'driver' ? 'Driver View' : 'Staff Portal'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNotifications(true)} className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Dialog open={showQR} onOpenChange={setShowQR}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <QrCode className="h-4 w-4 mr-1" /> QR
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Your QR Code</DialogTitle></DialogHeader>
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="bg-white p-6 border-2 border-dashed rounded-lg">
                    <p className="text-2xl font-mono font-bold tracking-wider">{laundromat.qrCode}</p>
                  </div>
                  <p className="text-sm text-gray-600 text-center">Customers can scan this code to access the app</p>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4">
        {/* Stripe Connect banner */}
        {!laundromat.stripeAccountId && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-amber-900">Connect Stripe to receive payments</p>
              <p className="text-sm text-amber-700">Customers cannot pay until you connect your Stripe account.</p>
            </div>
            <Button size="sm" onClick={handleConnectStripe} disabled={stripeConnecting} className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white">
              <CreditCard className="h-4 w-4 mr-1" />
              {stripeConnecting ? 'Loading…' : 'Connect Stripe'}
            </Button>
          </div>
        )}
        {laundromat.stripeAccountId && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <span>Stripe connected — you will receive payments automatically.</span>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="subscriptions">Plans</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
          </TabsList>

          {/* ORDERS */}
          <TabsContent value="orders" className="space-y-4">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orders yet</p>
                </CardContent>
              </Card>
            ) : (
              orders.map(order => {
                const customer = orderCustomers[order.customerId];
                return (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-gray-600">{order.serviceName}</p>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            {getStatusIcon(order.status)}
                            <span>{getStatusLabel(order.status)}</span>
                          </div>
                        </div>
                        <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                          ${order.price.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <span>{customer?.name ?? '—'} {customer?.phone ? `- ${customer.phone}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="truncate">{order.pickupAddress}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>{new Date(order.scheduledPickup).toLocaleString()}</span>
                        </div>
                        {order.notes && (
                          <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                            <FileText className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <span className="text-sm text-yellow-800">{order.notes}</span>
                          </div>
                        )}
                      </div>
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="mt-4 flex gap-2">
                          {order.status === 'pending' && (
                            <>
                              <Select onValueChange={(v) => assignDriver(order.id, v)}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Assign Driver" />
                                </SelectTrigger>
                                <SelectContent>
                                  {drivers.map(driver => (
                                    <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="destructive" onClick={() => updateOrderStatus(order.id, 'cancelled')}>Cancel</Button>
                            </>
                          )}
                          {order.status === 'picked_up' && (
                            <Button onClick={() => updateOrderStatus(order.id, 'in_progress')} className="flex-1">Start Processing</Button>
                          )}
                          {order.status === 'in_progress' && (
                            <Button onClick={() => updateOrderStatus(order.id, 'delivered')} className="flex-1">Mark Delivered</Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* AVAILABLE */}
          <TabsContent value="available" className="space-y-4">
            {session.user.role === 'driver' ? (
              availableOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No available orders</p>
                  </CardContent>
                </Card>
              ) : (
                availableOrders.map(order => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-gray-600">{order.serviceName}</p>
                        </div>
                        <Badge>${order.price.toFixed(2)}</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><MapPin className="h-4 w-4 inline mr-1" />{order.pickupAddress}</p>
                        <p><Clock className="h-4 w-4 inline mr-1" />{new Date(order.scheduledPickup).toLocaleString()}</p>
                      </div>
                      <Button onClick={() => acceptOrder(order.id)} className="w-full mt-3">Accept Order</Button>
                    </CardContent>
                  </Card>
                ))
              )
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <p>Driver view only</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* SERVICES */}
          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Your Services</CardTitle>
                <Button size="sm" onClick={() => setShowAddService(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Service
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No services configured</p>
                ) : (
                  services.map(service => (
                    <div key={service.id} className={`p-4 border rounded-lg ${service.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{service.name}</p>
                            {!service.isActive && <Badge variant="secondary">Inactive</Badge>}
                            {service.price !== service.recommendedPrice && (
                              <Badge variant="outline" className="text-orange-600 border-orange-200">Custom Price</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{service.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-gray-400" />
                              <span className="font-bold">${service.price.toFixed(2)}</span>
                            </div>
                            <div className="text-sm text-gray-500">Recommended: ${service.recommendedPrice.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingService(service)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleServiceStatus(service.id)}>
                            {service.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteService(service.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SUBSCRIPTIONS */}
          <TabsContent value="subscriptions">
            <Card>
              <CardHeader><CardTitle>Active Subscription Plans</CardTitle></CardHeader>
              <CardContent>
                {subscriptions.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No active subscription plans</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subscriptions.map(sub => {
                      const customer = subCustomers[sub.customerId];
                      const svc = subServices[sub.serviceId];
                      return (
                        <div key={sub.id} className="p-4 border rounded-lg bg-white">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{customer?.name ?? 'Unknown Customer'}</p>
                                <Badge variant="secondary" className="capitalize">{sub.frequency}</Badge>
                              </div>
                              <p className="text-sm text-gray-600">{customer?.email}</p>
                              <p className="text-sm text-gray-600 mt-1">Service: {svc?.name ?? sub.serviceId}</p>
                              <p className="text-sm text-gray-600">Pickup day: {sub.pickupDay}</p>
                              <p className="text-sm text-gray-600">Next pickup: {new Date(sub.nextPickup).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${sub.price.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">per cycle</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DRIVERS */}
          <TabsContent value="drivers">
            <Card>
              <CardHeader><CardTitle>Drivers</CardTitle></CardHeader>
              <CardContent>
                {drivers.length === 0 ? (
                  <p className="text-gray-500">No drivers registered yet</p>
                ) : (
                  <div className="space-y-2">
                    {drivers.map(driver => (
                      <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{driver.name}</p>
                          <p className="text-sm text-gray-600">{driver.email}</p>
                        </div>
                        <Truck className="h-4 w-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* NOTIFICATIONS PANEL */}
        {showNotifications && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowNotifications(false)} />
            <div className="relative w-full max-w-sm bg-white h-full shadow-xl overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold">Notifications</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="divide-y">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 cursor-pointer transition-colors ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}
                      onClick={() => handleMarkNotifRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-2 w-2 rounded-full mt-2 ${notification.isRead ? 'bg-gray-300' : 'bg-blue-500'}`} />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-sm text-gray-600">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* EDIT SERVICE DIALOG */}
        <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
            {editingService && (
              <form onSubmit={handleUpdateService} className="space-y-4">
                <div>
                  <Label>Service Name</Label>
                  <Input value={editingService.name} onChange={(e) => setEditingService({ ...editingService, name: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={editingService.description} onChange={(e) => setEditingService({ ...editingService, description: e.target.value })} />
                </div>
                <div>
                  <Label>Price ($)</Label>
                  <Input type="number" step="0.01" value={editingService.price}
                    onChange={(e) => setEditingService({ ...editingService, price: parseFloat(e.target.value) })} />
                  <p className="text-sm text-gray-500 mt-1">Recommended: ${editingService.recommendedPrice.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingService(null)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">Save Changes</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* ADD SERVICE DIALOG */}
        <Dialog open={showAddService} onOpenChange={setShowAddService}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Service</DialogTitle></DialogHeader>
            <form onSubmit={handleAddService} className="space-y-4">
              <div>
                <Label>Use Recommended Template (Optional)</Label>
                <Select value={newService.useTemplate} onValueChange={(v) => {
                  const template = RECOMMENDED_SERVICES.find(t => t.name === v);
                  setNewService({ ...newService, useTemplate: v, name: template?.name ?? '', description: template?.description ?? '', price: template?.recommendedPrice.toString() ?? '' });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select a template or create custom" /></SelectTrigger>
                  <SelectContent>
                    {RECOMMENDED_SERVICES.map(t => (
                      <SelectItem key={t.name} value={t.name}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                          <span>{t.name} - ${t.recommendedPrice}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Or Create Custom Service</p>
                <div>
                  <Label>Service Name</Label>
                  <Input value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} placeholder="e.g., Express Wash" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} placeholder="Describe the service…" />
                </div>
                <div>
                  <Label>Price ($)</Label>
                  <Input type="number" step="0.01" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddService(false)} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">Add Service</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
