'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authClient, useSession, getAuthHeaders } from '@/lib/auth/client';
import {
  findNearestLaundromat, getActiveServicesByLaundromat, createDefaultServices,
  getOrdersByCustomer, getNotificationsByUser, getUnreadNotificationsByUser,
  getSubscriptionsByCustomer, getServiceById,
  validatePromoCode, applyPromoCode as applyPromoAction,
  createOrder, createPayment, createSubscription as createSubAction,
  cancelSubscription as cancelSubAction,
  updateOrder, updateUser, createOrderStatusNotification,
  markNotificationRead as markNotifRead, markAllNotificationsRead
} from '@/lib/actions';
import { calculatePlatformFee } from '@/lib/types';
import type { Laundromat, Service, Order, Subscription, Notification } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MapPin, Shirt, Clock, CreditCard, Package, CheckCircle, Truck,
  Bell, Tag, Calendar, X, ChevronRight, Home, History, LogOut
} from 'lucide-react';

type Step = 'address' | 'schedule' | 'payment' | 'tracking';

export default function CustomerApp() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // Auth form (sign-up / sign-in)
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App state
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lon, setLon] = useState(0);
  const [nearestLaundromat, setNearestLaundromat] = useState<Laundromat | null | undefined>(undefined);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [scheduledPickup, setScheduledPickup] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [selectedPickupDay, setSelectedPickupDay] = useState('Monday');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = useCallback(async (userId: string) => {
    const [userOrders, notifs, unread, subs] = await Promise.all([
      getOrdersByCustomer(userId),
      getNotificationsByUser(userId),
      getUnreadNotificationsByUser(userId),
      getSubscriptionsByCustomer(userId),
    ]);
    setOrders(userOrders);
    setNotifications(notifs);
    setUnreadCount(unread.length);
    setSubscriptions(subs);

    // Resolve service names for subscriptions
    const ids = [...new Set(subs.map(s => s.serviceId))];
    const names: Record<string, string> = {};
    await Promise.all(ids.map(async id => {
      const svc = await getServiceById(id);
      if (svc) names[id] = svc.name;
    }));
    setServiceNames(names);
  }, []);

  useEffect(() => {
    if (!isPending && session?.user) {
      loadData(session.user.id);
    }
  }, [session, isPending, loadData]);

  // ── AUTH ──────────────────────────────────────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const { error } = await authClient.signIn.email({
      email: authForm.email,
      password: authForm.password,
    });
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message ?? 'Invalid email or password');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const { data, error } = await authClient.signUp.email({
      name: authForm.name,
      email: authForm.email,
      password: authForm.password,
    });
    if (error) {
      setAuthError(error.message ?? 'Sign up failed');
      setAuthLoading(false);
      return;
    }
    // Save phone number to user record after signup
    if (data?.user?.id && authForm.phone) {
      await updateUser(data.user.id, { phone: authForm.phone });
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    localStorage.removeItem('bearer_token');
    router.refresh();
  };

  // ── LAUNDROMAT SEARCH ─────────────────────────────────────────────────────

  const findLaundromat = async () => {
    setNearestLaundromat(undefined);
    const mockLat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const mockLon = -74.006 + (Math.random() - 0.5) * 0.1;
    setLat(mockLat);
    setLon(mockLon);

    const nearest = await findNearestLaundromat(mockLat, mockLon);
    if (nearest) {
      setNearestLaundromat(nearest);
      let svcList = await getActiveServicesByLaundromat(nearest.id);
      if (svcList.length === 0) svcList = await createDefaultServices(nearest.id);
      setServices(svcList);
      setSelectedService(svcList[0]);
      setScheduledPickup('');
      setOrderNotes('');
      setPromoCode('');
      setPromoDiscount(0);
      setPromoApplied(false);
      setPromoError('');
      setStep('schedule');
    } else {
      setNearestLaundromat(null);
    }
  };

  // ── PROMO ─────────────────────────────────────────────────────────────────

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || promoApplied) return;
    const price = selectedService?.price ?? 0;
    const validation = await validatePromoCode(promoCode);
    if (validation.valid && validation.promoCode) {
      const pc = validation.promoCode;
      const discount = Math.min(
        Math.round(price * (pc.discountPercent / 100) * 100) / 100,
        pc.maxDiscount
      );
      setPromoDiscount(discount);
      setPromoApplied(true);
      setPromoError('');
    } else {
      setPromoError(validation.message ?? 'Invalid promo code');
      setPromoDiscount(0);
    }
  };

  // ── PAYMENT ───────────────────────────────────────────────────────────────

  const handlePayment = async () => {
    if (!session?.user || !nearestLaundromat || !selectedService) return;
    setIsProcessing(true);
    try {
      const basePrice = selectedService.price;
      let discount = 0;
      if (promoApplied && promoCode) {
        const result = await applyPromoAction(promoCode, basePrice);
        if (result.success) discount = result.discount;
      }
      const finalPrice = basePrice - discount;
      const platformFee = calculatePlatformFee(finalPrice);

      const order = await createOrder({
        customerId: session.user.id,
        laundromatId: nearestLaundromat.id,
        driverId: null,
        status: 'pending',
        pickupAddress: address,
        pickupLatitude: lat,
        pickupLongitude: lon,
        deliveryAddress: address,
        deliveryLatitude: lat,
        deliveryLongitude: lon,
        scheduledPickup: new Date(scheduledPickup),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        notes: orderNotes || null,
        price: finalPrice,
        platformFee,
      });

      await createPayment({
        orderId: order.id,
        amount: finalPrice,
        platformFee,
        laundromatPayout: finalPrice - platformFee,
        discountAmount: discount,
        promoCode: discount > 0 ? promoCode : null,
        status: 'completed',
      });

      await createOrderStatusNotification(session.user.id, order.id, 'pending');
      setCurrentOrder(order);
      setStep('tracking');
      await loadData(session.user.id);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── CANCEL ORDER ──────────────────────────────────────────────────────────

  const cancelOrder = async (orderId: string) => {
    if (!session?.user) return;
    if (!confirm('Are you sure you want to cancel this order?')) return;
    await updateOrder(orderId, { status: 'cancelled' });
    await createOrderStatusNotification(session.user.id, orderId, 'cancelled');
    await loadData(session.user.id);
    if (currentOrder?.id === orderId) {
      const updated = orders.find(o => o.id === orderId);
      if (updated) setCurrentOrder({ ...updated, status: 'cancelled' });
    }
  };

  // ── SUBSCRIPTION ──────────────────────────────────────────────────────────

  const handleCreateSubscription = async () => {
    if (!session?.user || !nearestLaundromat || !selectedService) return;
    const nextPickup = new Date();
    nextPickup.setDate(nextPickup.getDate() + 7);
    await createSubAction({
      customerId: session.user.id,
      laundromatId: nearestLaundromat.id,
      serviceId: selectedService.id,
      frequency: selectedFrequency,
      pickupDay: selectedPickupDay,
      price: selectedService.price,
      isActive: true,
      nextPickup,
    });
    setShowSubscriptionModal(false);
    await loadData(session.user.id);
  };

  const handleCancelSubscription = async (subId: string) => {
    if (!confirm('Cancel this subscription?')) return;
    await cancelSubAction(subId);
    if (session?.user) await loadData(session.user.id);
  };

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

  const handleMarkAllRead = async () => {
    if (!session?.user) return;
    await markAllNotificationsRead(session.user.id);
    await loadData(session.user.id);
  };

  const handleMarkNotifRead = async (id: string) => {
    await markNotifRead(id);
    if (session?.user) await loadData(session.user.id);
  };

  // ── HELPERS ───────────────────────────────────────────────────────────────

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'picked_up': return <Truck className="h-5 w-5 text-blue-500" />;
      case 'in_progress': return <Package className="h-5 w-5 text-purple-500" />;
      case 'delivered': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled': return <X className="h-5 w-5 text-red-500" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  const statusLabel: Record<string, string> = {
    pending: 'Pending Pickup', picked_up: 'Picked Up',
    in_progress: 'In Progress', delivered: 'Delivered', cancelled: 'Cancelled',
  };

  // ── LOADING ───────────────────────────────────────────────────────────────

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Shirt className="h-5 w-5 text-white" />
          </div>
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  // ── AUTH SCREEN ───────────────────────────────────────────────────────────

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500">
              <Shirt className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">FreshFold</h1>
            <p className="text-gray-600 mt-1">Laundry pickup &amp; delivery</p>
          </div>
          <Card>
            <CardHeader>
              <div className="flex gap-2">
                <button
                  onClick={() => setAuthTab('signin')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authTab === 'signin' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthTab('signup')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${authTab === 'signup' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Create Account
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {authTab === 'signin' ? (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="jane@email.com" required />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" required />
                  </div>
                  {authError && <p className="text-sm text-red-500">{authError}</p>}
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? 'Signing in…' : 'Sign In'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Jane Smith" required />
                  </div>
                  <div>
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="jane@email.com" required />
                  </div>
                  <div>
                    <Label htmlFor="su-phone">Phone Number <span className="text-gray-400 font-normal">(for pickup reminders)</span></Label>
                    <Input id="su-phone" type="tel" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" required minLength={8} />
                  </div>
                  {authError && <p className="text-sm text-red-500">{authError}</p>}
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? 'Creating account…' : 'Get Started'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── SCHEDULE ──────────────────────────────────────────────────────────────

  if (step === 'schedule') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-md pt-6">
          <Button variant="ghost" onClick={() => setStep('address')} className="mb-4">← Back</Button>
          <Card>
            <CardHeader>
              <CardTitle>Schedule Pickup</CardTitle>
              {nearestLaundromat && (
                <p className="text-sm text-gray-600">Connected to: <strong>{nearestLaundromat.name}</strong></p>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">Select Service</Label>
                <div className="space-y-2">
                  {services.map(service => (
                    <div
                      key={service.id}
                      onClick={() => { setSelectedService(service); setPromoDiscount(0); setPromoApplied(false); }}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedService?.id === service.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-gray-500">{service.description}</p>
                        </div>
                        <p className="font-bold text-lg ml-4">${service.price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="datetime">Pickup Date &amp; Time</Label>
                <Input id="datetime" type="datetime-local" value={scheduledPickup} onChange={(e) => setScheduledPickup(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="notes">Special Instructions <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Textarea
                  id="notes"
                  placeholder="E.g., Ring doorbell, separate darks/lights, fragrance-free detergent…"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium mb-2 flex items-center gap-1"><Calendar className="h-4 w-4" /> Want recurring pickups?</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSubscriptionModal(true)} className="w-full">
                  Set Up Subscription
                </Button>
              </div>
              <Button
                onClick={() => { if (selectedService && scheduledPickup) setStep('payment'); }}
                className="w-full"
                disabled={!selectedService || !scheduledPickup}
              >
                Continue to Payment
              </Button>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Set Up Recurring Pickup</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Frequency</Label>
                <Select value={selectedFrequency} onValueChange={(v) => setSelectedFrequency(v as 'weekly' | 'biweekly' | 'monthly')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred Pickup Day</Label>
                <Select value={selectedPickupDay} onValueChange={setSelectedPickupDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p><strong>{selectedService?.name}</strong> · ${selectedService?.price.toFixed(2)} per pickup</p>
                <p className="text-gray-600 mt-1">
                  {selectedFrequency === 'weekly' ? 'Every week' : selectedFrequency === 'biweekly' ? 'Every 2 weeks' : 'Every month'} on {selectedPickupDay}s
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSubscriptionModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleCreateSubscription} className="flex-1">Create Subscription</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── PAYMENT ───────────────────────────────────────────────────────────────

  if (step === 'payment') {
    const basePrice = selectedService?.price ?? 0;
    const finalPrice = Math.max(0, basePrice - promoDiscount);
    const fee = calculatePlatformFee(finalPrice);
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-md pt-6">
          <Button variant="ghost" onClick={() => setStep('schedule')} className="mb-4">← Back</Button>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Review &amp; Pay
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="p-3 bg-blue-50 rounded-lg space-y-1">
                <p className="font-medium">{selectedService?.name}</p>
                <p className="text-sm text-gray-600">{selectedService?.description}</p>
                <p className="text-sm text-gray-500"><MapPin className="h-3 w-3 inline mr-1" />{address}</p>
                <p className="text-sm text-gray-500"><Clock className="h-3 w-3 inline mr-1" />{new Date(scheduledPickup).toLocaleString()}</p>
                {orderNotes && <p className="text-sm text-gray-500 italic">"{orderNotes}"</p>}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-sm"><Tag className="h-4 w-4" /> Promo Code</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      if (promoApplied) { setPromoApplied(false); setPromoDiscount(0); }
                    }}
                    disabled={promoApplied}
                  />
                  <Button type="button" variant="outline" onClick={handleApplyPromo} disabled={promoApplied || !promoCode.trim()}>
                    {promoApplied ? 'Applied' : 'Apply'}
                  </Button>
                </div>
                {promoError && <p className="text-sm text-red-500">{promoError}</p>}
                {promoApplied && <p className="text-sm text-green-600">Promo applied — saving ${promoDiscount.toFixed(2)}!</p>}
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between text-sm"><span>Service</span><span>${basePrice.toFixed(2)}</span></div>
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({promoCode})</span><span>-${promoDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-500"><span>Platform fee (15%)</span><span>${fee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>${(finalPrice + fee).toFixed(2)}</span></div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-dashed">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Payment details (demo)</p>
                <div className="space-y-2">
                  <Input placeholder="Card Number" defaultValue="4242 4242 4242 4242" />
                  <div className="flex gap-2">
                    <Input placeholder="MM/YY" defaultValue="12/27" className="flex-1" />
                    <Input placeholder="CVC" defaultValue="123" className="w-20" />
                  </div>
                </div>
              </div>

              <Button onClick={handlePayment} className="w-full" disabled={isProcessing}>
                {isProcessing ? 'Processing…' : `Pay $${(finalPrice + fee).toFixed(2)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── MAIN APP ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <Shirt className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">FreshFold</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowNotifications(true)} className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-md flex justify-around mt-2 border-t pt-2">
          {(['home', 'orders', 'subscriptions'] as const).map(tab => {
            const icons = { home: <Home className="h-4 w-4" />, orders: <History className="h-4 w-4" />, subscriptions: <Calendar className="h-4 w-4" /> };
            const labels = { home: 'Home', orders: 'Orders', subscriptions: 'Plans' };
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1 text-sm px-3 py-1 rounded-full transition-colors ${activeTab === tab ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500'}`}>
                {icons[tab]} {labels[tab]}
              </button>
            );
          })}
        </div>
      </header>

      <div className="p-4 pb-10">
        <div className="mx-auto max-w-md">

          {/* HOME TAB */}
          {activeTab === 'home' && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Schedule a Pickup</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {step === 'tracking' && currentOrder && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Active order #{currentOrder.id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-500">{statusLabel[currentOrder.status]}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('orders')}>Track</Button>
                    </div>
                  )}
                  <Input
                    placeholder="Enter your full address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Button onClick={findLaundromat} disabled={!address} className="w-full">
                    Find Nearest Laundromat
                  </Button>
                  {nearestLaundromat === null && (
                    <p className="text-sm text-red-500 text-center">No laundromat services your area yet. Try a different address.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Your Orders</h2>
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No orders yet</p>
                    <Button variant="link" onClick={() => setActiveTab('home')}>Place your first order</Button>
                  </CardContent>
                </Card>
              ) : (
                orders.map(order => (
                  <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setCurrentOrder(order); setActiveTab('home'); setStep('tracking'); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.serviceName}</p>
                          <p className="text-sm text-gray-500">{new Date(order.scheduledPickup).toLocaleString()}</p>
                          <p className="text-sm font-medium">${order.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(order.status)}
                          <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}>
                            {statusLabel[order.status]}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* SUBSCRIPTIONS TAB */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Recurring Plans</h2>
              {subscriptions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No active plans</p>
                    <p className="text-sm mt-1">Set one up when scheduling your next pickup.</p>
                  </CardContent>
                </Card>
              ) : (
                subscriptions.map(sub => (
                  <Card key={sub.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{serviceNames[sub.serviceId] ?? 'Service'}</p>
                          <p className="text-sm text-gray-600 capitalize">{sub.frequency} · {sub.pickupDay}s</p>
                          <p className="text-sm text-gray-500">Next pickup: {new Date(sub.nextPickup).toLocaleDateString()}</p>
                          <p className="text-sm font-medium mt-1">${sub.price.toFixed(2)} / pickup</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleCancelSubscription(sub.id)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* TRACKING (inline in home tab) */}
          {step === 'tracking' && currentOrder && activeTab === 'home' && (
            <Card className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Order #{currentOrder.id.slice(0, 8)}</CardTitle>
                <Badge variant={currentOrder.status === 'delivered' ? 'default' : currentOrder.status === 'cancelled' ? 'destructive' : 'secondary'}>
                  {statusLabel[currentOrder.status]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{currentOrder.serviceName} · ${currentOrder.price.toFixed(2)}</p>
                  <p><Clock className="h-3 w-3 inline mr-1" />{new Date(currentOrder.scheduledPickup).toLocaleString()}</p>
                  {currentOrder.notes && <p className="italic">"{currentOrder.notes}"</p>}
                </div>
                {currentOrder.status !== 'cancelled' && (
                  <div className="space-y-2">
                    {['pending', 'picked_up', 'in_progress', 'delivered'].map((s, idx) => {
                      const steps = ['pending', 'picked_up', 'in_progress', 'delivered'];
                      const active = steps.indexOf(currentOrder.status) >= idx;
                      return (
                        <div key={s} className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            {active && steps.indexOf(currentOrder.status) > idx ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                          </div>
                          <span className={active ? 'font-medium' : 'text-gray-400 text-sm'}>{statusLabel[s]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {currentOrder.status === 'pending' && (
                    <Button variant="destructive" size="sm" onClick={() => cancelOrder(currentOrder.id)} className="flex-1">
                      Cancel Order
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { setStep('address'); setCurrentOrder(null); }} className="flex-1">
                    New Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Notifications panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNotifications(false)} />
          <div className="relative w-full max-w-sm bg-white h-full shadow-xl flex flex-col">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs text-blue-600">
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${n.isRead ? '' : 'bg-blue-50'}`}
                    onClick={() => handleMarkNotifRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-2 h-2 w-2 rounded-full shrink-0 ${n.isRead ? 'bg-gray-300' : 'bg-blue-500'}`} />
                      <div>
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-sm text-gray-600">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
