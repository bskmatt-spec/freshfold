'use client';

import { useEffect, useState } from 'react';
import {
  getAllLaundromats, getAllOrders, getAllPayments, getAllServices,
  getAllPromoCodes, createLaundromat, updateLaundromat,
  createPromoCode, updatePromoCode, getLaundromatById,
} from '@/lib/actions';
import { PLATFORM_FEE_PERCENT } from '@/lib/types';
import type { Laundromat, Order, Payment, Service, PromoCode } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Store, DollarSign, Package, TrendingUp, QrCode, Plus } from 'lucide-react';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [laundromats, setLaundromats] = useState<Laundromat[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedLaundromat, setSelectedLaundromat] = useState<string>('');
  const [newLaundromat, setNewLaundromat] = useState({
    name: '', address: '', latitude: '', longitude: '', deliveryRadius: '5', phone: '', email: '',
  });
  const [selectedQR, setSelectedQR] = useState<Laundromat | null>(null);
  const [showAddPromo, setShowAddPromo] = useState(false);
  const [newPromo, setNewPromo] = useState({
    code: '', discountPercent: '10', maxDiscount: '20', validFrom: '', validUntil: '', usageLimit: '100',
  });
  const [laundromatIds, setLaundromatIds] = useState<Record<string, Laundromat | null>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    const [ls, os, ps, svcs, promos] = await Promise.all([
      getAllLaundromats(),
      getAllOrders(),
      getAllPayments(),
      getAllServices(),
      getAllPromoCodes(),
    ]);
    setLaundromats(ls);
    setOrders(os);
    setPayments(ps);
    setServices(svcs);
    setPromoCodes(promos);

    // Resolve laundromat names for orders/services
    const ids = [...new Set([...os.map(o => o.laundromatId), ...svcs.map(s => s.laundromatId)])];
    const resolved: Record<string, Laundromat | null> = {};
    await Promise.all(ids.map(async id => {
      resolved[id] = await getLaundromatById(id);
    }));
    setLaundromatIds(resolved);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin44') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid password');
    }
  };

  const handleAddLaundromat = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await createLaundromat({
      name: newLaundromat.name,
      address: newLaundromat.address,
      latitude: parseFloat(newLaundromat.latitude),
      longitude: parseFloat(newLaundromat.longitude),
      deliveryRadius: parseFloat(newLaundromat.deliveryRadius),
      phone: newLaundromat.phone,
      email: newLaundromat.email,
    });
    setNewLaundromat({ name: '', address: '', latitude: '', longitude: '', deliveryRadius: '5', phone: '', email: '' });
    setIsSubmitting(false);
    await loadData();
  };

  const toggleLaundromatStatus = async (id: string) => {
    const l = laundromats.find(x => x.id === id);
    if (l) {
      await updateLaundromat(id, { isActive: !l.isActive });
      await loadData();
    }
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await createPromoCode({
      code: newPromo.code.toUpperCase(),
      discountPercent: parseInt(newPromo.discountPercent),
      maxDiscount: parseFloat(newPromo.maxDiscount),
      validFrom: new Date(newPromo.validFrom),
      validUntil: new Date(newPromo.validUntil),
      usageLimit: parseInt(newPromo.usageLimit),
      isActive: true,
    });
    setNewPromo({ code: '', discountPercent: '10', maxDiscount: '20', validFrom: '', validUntil: '', usageLimit: '100' });
    setShowAddPromo(false);
    setIsSubmitting(false);
    await loadData();
  };

  const togglePromoStatus = async (id: string) => {
    const promo = promoCodes.find(p => p.id === id);
    if (promo) {
      await updatePromoCode(id, { isActive: !promo.isActive });
      await loadData();
    }
  };

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const totalPlatformFees = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.platformFee, 0);
  const totalOrders = orders.length;
  const totalDiscounts = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.discountAmount ?? 0), 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">Admin Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-white">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password" required className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6" />
            <h1 className="font-semibold text-lg">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsAuthenticated(false)} className="text-gray-300 hover:text-white">
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="laundromats">Laundromats</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Store className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Laundromats</p>
                      <p className="text-2xl font-bold">{laundromats.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold">{totalOrders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Platform Fees ({PLATFORM_FEE_PERCENT}%)</p>
                      <p className="text-2xl font-bold">${totalPlatformFees.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 5).map(order => (
                      <TableRow key={order.id}>
                        <TableCell>#{order.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>{order.status}</Badge>
                        </TableCell>
                        <TableCell>${order.price.toFixed(2)}</TableCell>
                        <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LAUNDROMATS */}
          <TabsContent value="laundromats" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Add New Laundromat</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddLaundromat} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={newLaundromat.name} onChange={(e) => setNewLaundromat({ ...newLaundromat, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input value={newLaundromat.address} onChange={(e) => setNewLaundromat({ ...newLaundromat, address: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Latitude</Label>
                    <Input type="number" step="any" value={newLaundromat.latitude} onChange={(e) => setNewLaundromat({ ...newLaundromat, latitude: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input type="number" step="any" value={newLaundromat.longitude} onChange={(e) => setNewLaundromat({ ...newLaundromat, longitude: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Delivery Radius (miles)</Label>
                    <Input type="number" value={newLaundromat.deliveryRadius} onChange={(e) => setNewLaundromat({ ...newLaundromat, deliveryRadius: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={newLaundromat.phone} onChange={(e) => setNewLaundromat({ ...newLaundromat, phone: e.target.value })} required />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Email</Label>
                    <Input type="email" value={newLaundromat.email} onChange={(e) => setNewLaundromat({ ...newLaundromat, email: e.target.value })} required />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Adding…' : 'Add Laundromat'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>All Laundromats</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Radius (mi)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laundromats.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>{l.name}</TableCell>
                        <TableCell><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{l.id}</code></TableCell>
                        <TableCell>{l.deliveryRadius}</TableCell>
                        <TableCell>
                          <Badge variant={l.isActive ? 'default' : 'secondary'}>{l.isActive ? 'Active' : 'Inactive'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedQR(l)}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => toggleLaundromatStatus(l.id)}>
                            {l.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders">
            <Card>
              <CardHeader><CardTitle>All Orders</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Laundromat</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Platform Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>#{order.id.slice(0, 8)}</TableCell>
                        <TableCell>{laundromatIds[order.laundromatId]?.name ?? order.laundromatId.slice(0, 8)}</TableCell>
                        <TableCell>{order.serviceName}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>{order.status}</Badge>
                        </TableCell>
                        <TableCell>${order.price.toFixed(2)}</TableCell>
                        <TableCell>${order.platformFee.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SERVICES */}
          <TabsContent value="services">
            <Card>
              <CardHeader><CardTitle>Services by Laundromat</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label>Filter by Laundromat</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={selectedLaundromat}
                    onChange={(e) => setSelectedLaundromat(e.target.value)}
                  >
                    <option value="">All Laundromats</option>
                    {laundromats.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Laundromat</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>Recommended</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services
                      .filter(s => !selectedLaundromat || s.laundromatId === selectedLaundromat)
                      .map(service => (
                        <TableRow key={service.id}>
                          <TableCell>{laundromatIds[service.laundromatId]?.name ?? service.laundromatId.slice(0, 8)}</TableCell>
                          <TableCell>{service.name}</TableCell>
                          <TableCell className={service.price !== service.recommendedPrice ? 'text-orange-600 font-medium' : ''}>
                            ${service.price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-gray-500">${service.recommendedPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={service.isActive ? 'default' : 'secondary'}>
                              {service.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {service.price !== service.recommendedPrice && (
                              <Badge variant="outline" className="ml-2 text-orange-600 border-orange-200">Custom</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROMOS */}
          <TabsContent value="promos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Promo Codes</CardTitle>
                <Button size="sm" onClick={() => setShowAddPromo(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Promo
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Max Discount</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promoCodes.map(promo => (
                      <TableRow key={promo.id}>
                        <TableCell className="font-mono font-bold">{promo.code}</TableCell>
                        <TableCell>{promo.discountPercent}%</TableCell>
                        <TableCell>${promo.maxDiscount.toFixed(2)}</TableCell>
                        <TableCell>{promo.usageCount} / {promo.usageLimit}</TableCell>
                        <TableCell>{new Date(promo.validUntil).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={promo.isActive ? 'default' : 'secondary'}>
                            {promo.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => togglePromoStatus(promo.id)}>
                            {promo.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVENUE */}
          <TabsContent value="revenue">
            <Card>
              <CardHeader><CardTitle>Revenue Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">Platform Fees (15%)</p>
                    <p className="text-2xl font-bold">${totalPlatformFees.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Laundromat Payouts</p>
                    <p className="text-2xl font-bold">${(totalRevenue - totalPlatformFees).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Discounts</p>
                    <p className="text-2xl font-bold">${totalDiscounts.toFixed(2)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Platform Fee</TableHead>
                      <TableHead>Laundromat Payout</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell>#{payment.id.slice(0, 8)}</TableCell>
                        <TableCell>#{payment.orderId.slice(0, 8)}</TableCell>
                        <TableCell>${payment.amount.toFixed(2)}</TableCell>
                        <TableCell className={payment.discountAmount > 0 ? 'text-green-600' : ''}>
                          {payment.discountAmount > 0 ? `-$${payment.discountAmount.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>${payment.platformFee.toFixed(2)}</TableCell>
                        <TableCell>${payment.laundromatPayout.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>{payment.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* QR DIALOG */}
        <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{selectedQR?.name} - QR Code</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="bg-white p-8 border-2 border-dashed rounded-lg">
                <p className="text-3xl font-mono font-bold tracking-wider text-center">{selectedQR?.qrCode}</p>
              </div>
              <p className="text-sm text-gray-500">Laundromat ID: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{selectedQR?.id}</code></p>
            </div>
          </DialogContent>
        </Dialog>

        {/* ADD PROMO DIALOG */}
        <Dialog open={showAddPromo} onOpenChange={setShowAddPromo}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Promo Code</DialogTitle></DialogHeader>
            <form onSubmit={handleAddPromo} className="space-y-4">
              <div>
                <Label>Promo Code</Label>
                <Input value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} placeholder="e.g., SAVE20" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount %</Label>
                  <Input type="number" value={newPromo.discountPercent} onChange={(e) => setNewPromo({ ...newPromo, discountPercent: e.target.value })} required />
                </div>
                <div>
                  <Label>Max Discount ($)</Label>
                  <Input type="number" value={newPromo.maxDiscount} onChange={(e) => setNewPromo({ ...newPromo, maxDiscount: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valid From</Label>
                  <Input type="date" value={newPromo.validFrom} onChange={(e) => setNewPromo({ ...newPromo, validFrom: e.target.value })} required />
                </div>
                <div>
                  <Label>Valid Until</Label>
                  <Input type="date" value={newPromo.validUntil} onChange={(e) => setNewPromo({ ...newPromo, validUntil: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Usage Limit</Label>
                <Input type="number" value={newPromo.usageLimit} onChange={(e) => setNewPromo({ ...newPromo, usageLimit: e.target.value })} required />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddPromo(false)} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create Promo'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
