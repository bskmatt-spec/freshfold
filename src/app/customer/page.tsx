'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { User, Laundromat, Order, ServiceType, calculatePlatformFee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MapPin, Shirt, Clock, CreditCard, Package, CheckCircle, Truck, WashingMachine } from 'lucide-react';

const SERVICE_PRICES: Record<ServiceType, number> = {
  wash_fold: 25,
  dry_cleaning: 45
};

export default function CustomerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<'auth' | 'address' | 'schedule' | 'payment' | 'tracking'>('auth');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lon, setLon] = useState(0);
  const [nearestLaundromat, setNearestLaundromat] = useState<Laundromat | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('wash_fold');
  const [scheduledPickup, setScheduledPickup] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    db.init();
    const savedUser = localStorage.getItem('customer_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      loadOrders(parsed.id);
      setStep('address');
    }
  }, []);

  const loadOrders = (userId: string) => {
    setOrders(db.orders.getByCustomer(userId));
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
      setStep('schedule');
    }
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nearestLaundromat) return;
    
    const price = SERVICE_PRICES[serviceType];
    const platformFee = calculatePlatformFee(price);
    
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
      serviceType,
      price,
      platformFee
    });

    db.payments.create({
      orderId: order.id,
      amount: price,
      platformFee,
      laundromatPayout: price - platformFee,
      status: 'pending'
    });

    setCurrentOrder(order);
    setStep('payment');
  };

  const handlePayment = () => {
    if (!currentOrder) return;
    db.orders.update(currentOrder.id, { status: 'pending' });
    db.payments.update(db.payments.getByOrder(currentOrder.id)!.id, { status: 'completed' });
    setStep('tracking');
    if (user) loadOrders(user.id);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'picked_up': return <Truck className="h-5 w-5 text-blue-500" />;
      case 'in_progress': return <WashingMachine className="h-5 w-5 text-purple-500" />;
      case 'delivered': return <CheckCircle className="h-5 w-5 text-green-500" />;
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="mx-auto max-w-md pt-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Enter Your Address
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
              {orders.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-2">Your Orders</h3>
                  <div className="space-y-2">
                    {orders.slice(0, 3).map(order => (
                      <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <span>{new Date(order.scheduledPickup).toLocaleDateString()}</span>
                        <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                  <Label>Service Type</Label>
                  <Select value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wash_fold">Wash & Fold - $25</SelectItem>
                      <SelectItem value="dry_cleaning">Dry Cleaning - $45</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('address')} className="flex-1">Back</Button>
                  <Button type="submit" className="flex-1">Continue</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'payment') {
    const price = SERVICE_PRICES[serviceType];
    const fee = calculatePlatformFee(price);
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
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Service</span>
                  <span className="font-medium">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Platform Fee (15%)</span>
                  <span>${fee.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>${(price + fee).toFixed(2)}</span>
                </div>
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
              <Button onClick={handlePayment} className="w-full">Pay ${(price + fee).toFixed(2)}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-md pt-12">
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
                  </div>
                  {getStatusIcon(currentOrder.status)}
                </div>
                
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

                <Button onClick={() => setStep('address')} className="w-full">New Order</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
