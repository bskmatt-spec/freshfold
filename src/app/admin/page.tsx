'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { User, Laundromat, Order, Payment, PLATFORM_FEE_PERCENT } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, Store, DollarSign, Package, Users, TrendingUp, MapPin, QrCode } from 'lucide-react';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [laundromats, setLaundromats] = useState<Laundromat[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [newLaundromat, setNewLaundromat] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    deliveryRadius: '5',
    phone: '',
    email: ''
  });
  const [selectedQR, setSelectedQR] = useState<Laundromat | null>(null);

  useEffect(() => {
    db.init();
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = () => {
    setLaundromats(db.laundromats.getAll());
    setOrders(db.orders.getAll());
    setPayments(db.payments.getAll());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid password');
    }
  };

  const handleAddLaundromat = (e: React.FormEvent) => {
    e.preventDefault();
    db.laundromats.create({
      name: newLaundromat.name,
      address: newLaundromat.address,
      latitude: parseFloat(newLaundromat.latitude),
      longitude: parseFloat(newLaundromat.longitude),
      deliveryRadius: parseFloat(newLaundromat.deliveryRadius),
      phone: newLaundromat.phone,
      email: newLaundromat.email,
      isActive: true
    });
    setNewLaundromat({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      deliveryRadius: '5',
      phone: '',
      email: ''
    });
    loadData();
  };

  const toggleLaundromatStatus = (id: string) => {
    const l = db.laundromats.getById(id);
    if (l) {
      db.laundromats.update(id, { isActive: !l.isActive });
      loadData();
    }
  };

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const totalPlatformFees = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.platformFee, 0);
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'delivered').length;

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
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
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
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsAuthenticated(false)}
            className="text-gray-300 hover:text-white"
          >
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="laundromats">Laundromats</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

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
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
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
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
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

          <TabsContent value="laundromats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Laundromat</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddLaundromat} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={newLaundromat.name}
                      onChange={(e) => setNewLaundromat({...newLaundromat, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input 
                      value={newLaundromat.address}
                      onChange={(e) => setNewLaundromat({...newLaundromat, address: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Latitude</Label>
                    <Input 
                      type="number"
                      step="any"
                      value={newLaundromat.latitude}
                      onChange={(e) => setNewLaundromat({...newLaundromat, latitude: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input 
                      type="number"
                      step="any"
                      value={newLaundromat.longitude}
                      onChange={(e) => setNewLaundromat({...newLaundromat, longitude: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Delivery Radius (miles)</Label>
                    <Input 
                      type="number"
                      value={newLaundromat.deliveryRadius}
                      onChange={(e) => setNewLaundromat({...newLaundromat, deliveryRadius: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input 
                      value={newLaundromat.phone}
                      onChange={(e) => setNewLaundromat({...newLaundromat, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={newLaundromat.email}
                      onChange={(e) => setNewLaundromat({...newLaundromat, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full">Add Laundromat</Button>
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
                      <TableHead>Radius (mi)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QR Code</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laundromats.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>{l.name}</TableCell>
                        <TableCell>{l.deliveryRadius}</TableCell>
                        <TableCell>
                          <Badge variant={l.isActive ? 'default' : 'secondary'}>
                            {l.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedQR(l)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => toggleLaundromatStatus(l.id)}
                          >
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

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>All Orders</CardTitle>
              </CardHeader>
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
                        <TableCell>{db.laundromats.getById(order.laundromatId)?.name}</TableCell>
                        <TableCell className="capitalize">{order.serviceType.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
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

          <TabsContent value="revenue">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Platform Fee (15%)</TableHead>
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
                        <TableCell>${payment.platformFee.toFixed(2)}</TableCell>
                        <TableCell>${payment.laundromatPayout.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedQR?.name} - QR Code</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="bg-white p-8 border-2 border-dashed rounded-lg">
                <p className="text-3xl font-mono font-bold tracking-wider text-center">{selectedQR?.qrCode}</p>
              </div>
              <p className="text-sm text-gray-600">ID: {selectedQR?.id}</p>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
