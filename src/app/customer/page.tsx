'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { User, Laundromat, Order, Service, Subscription, Notification, calculatePlatformFee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Shirt, Clock, CreditCard, Package, CheckCircle, Truck, WashingMachine, Bell, Tag, Calendar, X, ChevronRight, Home, History } from 'lucide-react';

export default function CustomerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<'auth' | 'address' | 'schedule' | 'payment' | 'tracking'>('auth');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lon, setLon] = useState(0);
  const [nearestLaundromat, setNearestLaundromat] = useState<Laundromat | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [scheduledPickup, setScheduledPickup] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '' });
  const [activeTab, setActiveTab] = useState('home');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [selectedPickupDay, setSelectedPickupDay] = useState('Monday');

  useEffect(() => {
    db.init();
    const savedUser = localStorage.getItem('customer_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      loadData(parsed.id);
      setStep('address');
    }
  }, []);

  const loadData = (userId: string) => {
    setOrders(db.orders.getByCustomer(userId));
    setNotifications(db.notifications.getByUser(userId));
    setUnreadCount(db.notifications.getUnreadByUser(userId).length);
    setSubscriptions(db.subscriptions.getByCustomer(userId));
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    let existingUser = db.users.getByEmail(authForm.email);
    if (!existingUser) {
      existingUser = db.users.create({
        email: authForm.email,
        name: authForm.name,
        phone: authForm.phone,
        role: 'customer'
      });
    }
    setUser(existingUser);
    localStorage.setItem('customer_user', JSON.stringify(existingUser));
    setStep('address');
  };

  const findLaundromat = () => {
    const mockLat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const mockLon = -74.0060 + (Math.random() - 0.5) * 0.1;
    setLat(mockLat);
    setLon(mockLon);
    
    const nearest = db.laundromats.findNearest(mockLat, mockLon);
    setNearestLaundromat(nearest || null);
    if (nearest) {
      const laundromatServices = db.services.getActiveByLaundromat(nearest.id);
      if (laundromatServices.length === 0) {
        const defaults = db.services.createDefaultsForLaundromat(nearest.id);
        setServices(defaults);
        setSelectedService(defaults[0]);
      } else {
        setServices(laundromatServices);
        setSelectedService(laundromatServices[0]);
      }
      setStep('schedule');
    }
  };

  const applyPromoCode = () => {
    if (!promoCode.trim()) return;
    const result = db.promoCodes.apply(promoCode, selectedService?.price || 0);
    if (result.success) {
      setPromoDiscount(result.discount);
      setPromoError('');
    } else {
      setPromoError(result.message || 'Invalid promo code');
      setPromoDiscount(0);
    }
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nearestLaundromat || !selectedService) return;
    
    const basePrice = selectedService.price;
    const finalPrice = basePrice - promoDiscount;
    const platformFee = calculatePlatformFee(finalPrice);
    
    const order = db.orders.create({
      customerId: user.id,
      laundromatId: nearestLaundromat.id,
      status: 'pending',
      pickupAddress: address,
      pickupLatitude: lat,
      pickupLongitude: lon,
      deliveryAddress: address,
      deliveryLatitude: lat,
      deliveryLongitude: lon,
      scheduledPickup,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      notes: orderNotes,
      price: finalPrice,
      platformFee
    });

    db.payments.create({
      orderId: order.id,
      amount: finalPrice,
      platformFee,
      laundromatPayout: finalPrice - platformFee,
      discountAmount: promoDiscount,
      promoCode: promoDiscount > 0 ? promoCode : undefined,
      status: 'pending'
    });

    db.notifications.createOrderStatusNotification(user.id, order.id, 'pending');

    setCurrentOrder(order);
    setStep('payment');
  };

  const handlePayment = () => {
    if (!currentOrder || !user) return;
    db.orders.update(currentOrder.id, { status: 'pending' });
    db.payments.update(db.payments.getByOrder(currentOrder.id)!.id, { status: 'completed' });
    db.notifications.createOrderStatusNotification(user.id, currentOrder.id, 'pending');
    setStep('tracking');
    loadData(user.id);
  };

  const cancelOrder = (orderId: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to cancel this order?')) {
      db.orders.update(orderId, { status: 'cancelled' });
      db.notifications.createOrderStatusNotification(user.id, orderId, 'cancelled');
      loadData(user.id);
      if (currentOrder?.id === orderId) {
        setCurrentOrder(db.orders.getById(orderId) || null);
      }
    }
  };

  const createSubscription = () => {
    if (!user || !nearestLaundromat || !selectedService) return;
    
    const nextPickup = new Date();
    nextPickup.setDate(nextPickup.getDate() + 7);
    
    db.subscriptions.create({
      customerId: user.id,
      laundromatId: nearestLaundromat.id,
      serviceId: selectedService.id,
      frequency: selectedFrequency,
      pickupDay: selectedPickupDay,
      price: selectedService.price,
      isActive: true,
      nextPickup: nextPickup.toISOString()
    });
    
    setShowSubscriptionModal(false);
    if (user) loadData(user.id);
  };

  const markNotificationRead = (notificationId: string) => {
    db.notifications.markAsRead(notificationId);
    if (user) {
      loadData(user.id);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'picked_up': return <Truck className="h-5 w-5 text-blue-500" />;
      case 'in_progress': return <WashingMachine className="h-5 w-5 text-purple-500" />;
      case 'delivered': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled': return <X className="h-5 w-5 text-red-500" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending Pickup',
      picked_up: 'Picked Up',
      in_progress: 'In Progress',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
  };

  if (step === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-md pt-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500">
                <Shirt className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">FreshFold Laundry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={authForm.phone} onChange={(e) => setAuthForm({...authForm, phone: e.target.value})} required />
                </div>
                <Button type="submit" className="w-full">Get Started</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'address') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <CustomerNavBar 
          user={user} 
          unreadCount={unreadCount} 
          onShowNotifications={() => setShowNotifications(true)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <div className="p-4 pb-24">
          <div className="mx-auto max-w-md">
            {activeTab === 'home' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Schedule a Pickup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input 
                    placeholder="Enter your full address" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Button 
                    onClick={findLaundromat} 
                    disabled={!address}
                    className="w-full"
                  >
                    Find Nearest Laundromat
                  </Button>
                  {nearestLaundromat === null && address && (
                    <p className="text-sm text-red-500 text-center">
                      No laundromat services your area. Try a different address.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Your Orders</h2>
                {orders.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No orders yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  orders.map(order => (
                    <Card key={order.id} className="cursor-pointer" onClick={() => { setCurrentOrder(order); setStep('tracking'); }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{order.serviceName}</p>
                            <p className="text-sm text-gray-600">{new Date(order.scheduledPickup).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}>
                              {getStatusLabel(order.status)}
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

            {activeTab === 'subscriptions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your Subscriptions</h2>
                </div>
                {subscriptions.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No active subscriptions</p>
                      <p className="text-sm">Create one when you schedule your next pickup</p>
                    </CardContent>
                  </Card>
                ) : (
                  subscriptions.map(sub => (
                    <Card key={sub.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{db.services.getById(sub.serviceId)?.name}</p>
                            <p className="text-sm text-gray-600 capitalize">{sub.frequency} on {sub.pickupDay}s</p>
                            <p className="text-sm text-gray-500">Next: {new Date(sub.nextPickup).toLocaleDateString()}</p>
                          </div>
                          <Badge>${sub.price.toFixed(2)}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <NotificationsPanel 
          open={showNotifications} 
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onMarkRead={markNotificationRead}
        />
      </div>
    );
  }

  if (step === 'schedule') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-md pt-12">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Pickup</CardTitle>
              {nearestLaundromat && (
                <p className="text-sm text-gray-600">
                  Connected to: <strong>{nearestLaundromat.name}</strong>
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSchedule} className="space-y-4">
                <div>
                  <Label>Select Service</Label>
                  <div className="space-y-2 mt-2">
                    {services.map(service => (
                      <div
                        key={service.id}
                        onClick={() => setSelectedService(service)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedService?.id === service.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-sm text-gray-600">{service.description}</p>
                            {service.price !== service.recommendedPrice && (
                              <p className="text-xs text-orange-600 mt-1">Custom pricing</p>
                            )}
                          </div>
                          <p className="font-bold text-lg">${service.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="datetime">Pickup Date & Time</Label>
                  <Input 
                    id="datetime" 
                    type="datetime-local" 
                    value={scheduledPickup}
                    onChange={(e) => setScheduledPickup(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Special Instructions (Optional)</Label>
                  <Input 
                    id="notes" 
                    placeholder="E.g., Ring doorbell, use side entrance..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                  />
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Want regular pickups?</p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowSubscriptionModal(true)}
                    className="w-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Set Up Subscription
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('address')} className="flex-1">Back</Button>
                  <Button type="submit" className="flex-1" disabled={!selectedService}>Continue</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Up Subscription</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Frequency</Label>
                <Select value={selectedFrequency} onValueChange={(v) => setSelectedFrequency(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pickup Day</Label>
                <Select value={selectedPickupDay} onValueChange={setSelectedPickupDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm">
                  <strong>{selectedService?.name}</strong> - ${selectedService?.price.toFixed(2)} per pickup
                </p>
                <p className="text-sm text-gray-600">
                  {selectedFrequency === 'weekly' ? 'Every week' : selectedFrequency === 'biweekly' ? 'Every 2 weeks' : 'Every month'} on {selectedPickupDay}s
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSubscriptionModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={createSubscription} className="flex-1">Create Subscription</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (step === 'payment') {
    const basePrice = selectedService?.price || 0;
    const finalPrice = basePrice - promoDiscount;
    const fee = calculatePlatformFee(finalPrice);
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-md pt-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium">{selectedService?.name}</p>
                <p className="text-sm text-gray-600">{selectedService?.description}</p>
                {orderNotes && (
                  <p className="text-sm text-gray-500 mt-1">Notes: {orderNotes}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Service</span>
                  <span className="font-medium">${basePrice.toFixed(2)}</span>
                </div>
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({promoCode})</span>
                    <span>-${promoDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Platform Fee (15%)</span>
                  <span>${fee.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>${(finalPrice + fee).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Promo Code
                </Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter code" 
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={applyPromoCode}>Apply</Button>
                </div>
                {promoError && <p className="text-sm text-red-500">{promoError}</p>}
                {promoDiscount > 0 && <p className="text-sm text-green-600">Promo applied successfully!</p>}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Mock Payment (Demo)</p>
                <div className="space-y-2">
                  <Input placeholder="Card Number" defaultValue="4242 4242 4242 4242" />
                  <div className="flex gap-2">
                    <Input placeholder="MM/YY" defaultValue="12/25" className="flex-1" />
                    <Input placeholder="CVC" defaultValue="123" className="w-20" />
                  </div>
                </div>
              </div>
              <Button onClick={handlePayment} className="w-full">Pay ${(finalPrice + fee).toFixed(2)}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <CustomerNavBar 
        user={user} 
        unreadCount={unreadCount} 
        onShowNotifications={() => setShowNotifications(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <div className="p-4 pb-24">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Track Your Order</CardTitle>
            </CardHeader>
            <CardContent>
              {currentOrder && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium">Order #{currentOrder.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600">{getStatusLabel(currentOrder.status)}</p>
                      <p className="text-sm text-gray-500">{currentOrder.serviceName}</p>
                    </div>
                    {getStatusIcon(currentOrder.status)}
                  </div>
                  
                  {currentOrder.notes && (
                    <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                      <p className="font-medium">Special Instructions:</p>
                      <p className="text-gray-600">{currentOrder.notes}</p>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {['pending', 'picked_up', 'in_progress', 'delivered'].map((status, idx) => (
                      <div key={status} className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          ['pending', 'picked_up', 'in_progress', 'delivered'].indexOf(currentOrder.status) >= idx
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200'
                        }`}>
                          {idx + 1}
                        </div>
                        <span className={['pending', 'picked_up', 'in_progress', 'delivered'].indexOf(currentOrder.status) >= idx ? '' : 'text-gray-400'}>
                          {getStatusLabel(status)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {currentOrder.status === 'pending' && (
                    <Button 
                      variant="destructive" 
                      onClick={() => cancelOrder(currentOrder.id)}
                      className="w-full"
                    >
                      Cancel Order
                    </Button>
                  )}

                  <Button onClick={() => setStep('address')} variant="outline" className="w-full">New Order</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <NotificationsPanel 
        open={showNotifications} 
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onMarkRead={markNotificationRead}
      />
    </div>
  );
}

function CustomerNavBar({ user, unreadCount, onShowNotifications, activeTab, onTabChange }: {
  user: User | null;
  unreadCount: number;
  onShowNotifications: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
      <div className="mx-auto max-w-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
            <Shirt className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold">FreshFold</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onShowNotifications} className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>
      <div className="mx-auto max-w-md flex justify-around mt-2">
        <button 
          onClick={() => onTabChange('home')}
          className={`flex items-center gap-1 pb-2 ${activeTab === 'home' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
        >
          <Home className="h-4 w-4" /> Home
        </button>
        <button 
          onClick={() => onTabChange('orders')}
          className={`flex items-center gap-1 pb-2 ${activeTab === 'orders' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
        >
          <History className="h-4 w-4" /> Orders
        </button>
        <button 
          onClick={() => onTabChange('subscriptions')}
          className={`flex items-center gap-1 pb-2 ${activeTab === 'subscriptions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
        >
          <Calendar className="h-4 w-4" /> Subscriptions
        </button>
      </div>
    </header>
  );
}

function NotificationsPanel({ open, onClose, notifications, onMarkRead }: {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold">Notifications</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
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
                onClick={() => onMarkRead(notification.id)}
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
  );
}
