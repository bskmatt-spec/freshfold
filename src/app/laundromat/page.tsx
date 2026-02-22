'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { User, Order, OrderWithDetails, Laundromat, Service, RECOMMENDED_SERVICES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, Truck, CheckCircle, Clock, MapPin, User as UserIcon, Store, QrCode, DollarSign, Plus, Edit, Trash2, Sparkles } from 'lucide-react';

export default function LaundromatPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [laundromat, setLaundromat] = useState<Laundromat | null>(null);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [availableOrders, setAvailableOrders] = useState<OrderWithDetails[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [authForm, setAuthForm] = useState({ email: '', laundromatId: '' });
  const [showQR, setShowQR] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: '',
    useTemplate: ''
  });

  useEffect(() => {
    db.init();
    const savedUser = localStorage.getItem('laundromat_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      const l = db.laundromats.getById(parsed.laundromatId!);
      if (l) {
        setLaundromat(l);
        loadData(l.id);
      }
    }
  }, []);

  const loadData = (laundromatId: string) => {
    const laundromatOrders = db.orders.getByLaundromat(laundromatId).map(o => db.orders.withDetails(o));
    setOrders(laundromatOrders);
    
    const available = db.orders.getAvailableForDriver()
      .filter(o => o.laundromatId === laundromatId)
      .map(o => db.orders.withDetails(o));
    setAvailableOrders(available);
    
    const allUsers = db.users.getAll();
    setDrivers(allUsers.filter(u => u.role === 'driver' && u.laundromatId === laundromatId));
    
    const laundromatServices = db.services.getByLaundromat(laundromatId);
    if (laundromatServices.length === 0) {
      const defaults = db.services.createDefaultsForLaundromat(laundromatId);
      setServices(defaults);
    } else {
      setServices(laundromatServices);
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const l = db.laundromats.getById(authForm.laundromatId);
    if (!l) {
      alert('Invalid laundromat ID');
      return;
    }

    let existingUser = db.users.getByEmail(authForm.email);
    if (!existingUser) {
      existingUser = db.users.create({
        email: authForm.email,
        name: 'Staff Member',
        phone: '',
        role: 'laundromat_staff',
        laundromatId: l.id
      });
    } else if (existingUser.role !== 'laundromat_staff' && existingUser.role !== 'driver') {
      existingUser = db.users.update(existingUser.id, { role: 'laundromat_staff', laundromatId: l.id })!;
    }

    setUser(existingUser);
    setLaundromat(l);
    localStorage.setItem('laundromat_user', JSON.stringify(existingUser));
    loadData(l.id);
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    db.orders.update(orderId, { status });
    if (laundromat) loadData(laundromat.id);
  };

  const assignDriver = (orderId: string, driverId: string) => {
    db.orders.update(orderId, { driverId, status: 'picked_up' });
    if (laundromat) loadData(laundromat.id);
  };

  const acceptOrder = (orderId: string) => {
    if (!user) return;
    db.orders.update(orderId, { driverId: user.id, status: 'picked_up' });
    if (laundromat) loadData(laundromat.id);
  };

  const handleUpdateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    
    db.services.update(editingService.id, {
      name: editingService.name,
      description: editingService.description,
      price: editingService.price
    });
    
    setEditingService(null);
    if (laundromat) loadData(laundromat.id);
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!laundromat) return;
    
    let template = RECOMMENDED_SERVICES.find(t => t.name === newService.useTemplate);
    
    db.services.create({
      laundromatId: laundromat.id,
      name: template ? template.name : newService.name,
      description: template ? template.description : newService.description,
      price: parseFloat(newService.price) || (template ? template.recommendedPrice : 0),
      recommendedPrice: template ? template.recommendedPrice : (parseFloat(newService.price) || 0),
      isActive: true
    });
    
    setNewService({ name: '', description: '', price: '', useTemplate: '' });
    setShowAddService(false);
    loadData(laundromat.id);
  };

  const toggleServiceStatus = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      db.services.update(serviceId, { isActive: !service.isActive });
      if (laundromat) loadData(laundromat.id);
    }
  };

  const deleteService = (serviceId: string) => {
    if (confirm('Delete this service?')) {
      db.services.delete(serviceId);
      if (laundromat) loadData(laundromat.id);
    }
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
      pending: 'Pending',
      picked_up: 'Picked Up',
      in_progress: 'In Progress',
      delivered: 'Delivered'
    };
    return labels[status] || status;
  };

  if (!user || !laundromat) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-md pt-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
                <Store className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Laundromat Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={authForm.email} 
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    placeholder="staff@laundromat.com"
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="laundromatId">Laundromat ID</Label>
                  <Input 
                    id="laundromatId" 
                    value={authForm.laundromatId} 
                    onChange={(e) => setAuthForm({...authForm, laundromatId: e.target.value})}
                    placeholder="Enter laundromat ID"
                    required 
                  />
                </div>
                <Button type="submit" className="w-full">Sign In</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <p className="text-sm text-gray-500">{user.role === 'driver' ? 'Driver View' : 'Staff Portal'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={showQR} onOpenChange={setShowQR}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <QrCode className="h-4 w-4 mr-1" /> QR
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Your QR Code</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="bg-white p-6 border-2 border-dashed rounded-lg">
                    <div className="text-center">
                      <p className="text-2xl font-mono font-bold tracking-wider">{laundromat.qrCode}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    Customers can scan this code to access the app directly
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                localStorage.removeItem('laundromat_user');
                setUser(null);
                setLaundromat(null);
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orders yet</p>
                </CardContent>
              </Card>
            ) : (
              orders.map(order => (
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
                        <span>{order.customer.name} - {order.customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{order.pickupAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{new Date(order.scheduledPickup).toLocaleString()}</span>
                      </div>
                    </div>

                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <div className="mt-4 flex gap-2">
                        {order.status === 'pending' && (
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
                        )}
                        {order.status === 'picked_up' && (
                          <Button onClick={() => updateOrderStatus(order.id, 'in_progress')} className="flex-1">
                            Start Processing
                          </Button>
                        )}
                        {order.status === 'in_progress' && (
                          <Button onClick={() => updateOrderStatus(order.id, 'delivered')} className="flex-1">
                            Mark Delivered
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            {user?.role === 'driver' ? (
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
                      <Button onClick={() => acceptOrder(order.id)} className="w-full mt-3">
                        Accept Order
                      </Button>
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
                              <Badge variant="outline" className="text-orange-600 border-orange-200">
                                Custom Price
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{service.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-gray-400" />
                              <span className="font-bold">${service.price.toFixed(2)}</span>
                            </div>
                            <div className="text-sm text-gray-500">
                              Recommended: ${service.recommendedPrice.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingService(service)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => toggleServiceStatus(service.id)}
                          >
                            {service.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteService(service.id)}
                          >
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

          <TabsContent value="drivers">
            <Card>
              <CardHeader>
                <CardTitle>Drivers</CardTitle>
              </CardHeader>
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

        <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Service</DialogTitle>
            </DialogHeader>
            {editingService && (
              <form onSubmit={handleUpdateService} className="space-y-4">
                <div>
                  <Label>Service Name</Label>
                  <Input 
                    value={editingService.name}
                    onChange={(e) => setEditingService({...editingService, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input 
                    value={editingService.description}
                    onChange={(e) => setEditingService({...editingService, description: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Price ($)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editingService.price}
                    onChange={(e) => setEditingService({...editingService, price: parseFloat(e.target.value)})}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Recommended: ${editingService.recommendedPrice.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingService(null)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">Save Changes</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showAddService} onOpenChange={setShowAddService}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Service</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddService} className="space-y-4">
              <div>
                <Label>Use Recommended Template (Optional)</Label>
                <Select 
                  value={newService.useTemplate} 
                  onValueChange={(v) => {
                    const template = RECOMMENDED_SERVICES.find(t => t.name === v);
                    setNewService({
                      ...newService,
                      useTemplate: v,
                      name: template?.name || '',
                      description: template?.description || '',
                      price: template?.recommendedPrice.toString() || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template or create custom" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECOMMENDED_SERVICES.map(template => (
                      <SelectItem key={template.name} value={template.name}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                          <span>{template.name} - ${template.recommendedPrice}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 mt-1">
                  Choose from our recommended services or create your own
                </p>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Or Create Custom Service</p>
                
                <div className="space-y-3">
                  <div>
                    <Label>Service Name</Label>
                    <Input 
                      value={newService.name}
                      onChange={(e) => setNewService({...newService, name: e.target.value})}
                      placeholder="e.g., Express Wash"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input 
                      value={newService.description}
                      onChange={(e) => setNewService({...newService, description: e.target.value})}
                      placeholder="Describe the service..."
                    />
                  </div>
                  <div>
                    <Label>Price ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newService.price}
                      onChange={(e) => setNewService({...newService, price: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
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
