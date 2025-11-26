import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  LogOut,
  Package,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  Users,
  Plus,
  Edit,
  Trash2,
  Truck,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock_quantity: number;
  unit: string;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  user_id: string;
}

interface MaliciousActivity {
  id: string;
  activity_type: string;
  description: string;
  detected_at: string;
  order_id: string | null;
  user_id: string | null;
  delivery_person_id: string | null;
}

interface DeliveryApplication {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  license_number: string | null;
  status: string;
  created_at: string;
}

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [maliciousActivities, setMaliciousActivities] = useState<MaliciousActivity[]>([]);
  const [deliveryApplications, setDeliveryApplications] = useState<DeliveryApplication[]>([]);
  const [stats, setStats] = useState({ totalOrders: 0, pendingOrders: 0, deliveredOrders: 0, revenue: 0 });
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    stock_quantity: '',
    unit: 'piece',
    category_id: '',
    image_url: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
    subscribeToChanges();
  }, [user, navigate]);

  const subscribeToChanges = () => {
    const ordersChannel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    const maliciousChannel = supabase
      .channel('admin-malicious')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'malicious_activities' }, fetchMaliciousActivities)
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(maliciousChannel);
    };
  };

  const fetchData = async () => {
    await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchOrders(),
      fetchMaliciousActivities(),
      fetchDeliveryApplications(),
      fetchStats()
    ]);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    if (data) setCategories(data);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setOrders(data);
  };

  const fetchMaliciousActivities = async () => {
    const { data } = await supabase
      .from('malicious_activities')
      .select('*')
      .order('detected_at', { ascending: false });
    if (data) setMaliciousActivities(data);
  };

  const fetchDeliveryApplications = async () => {
    const { data } = await supabase
      .from('delivery_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDeliveryApplications(data);
  };

  const fetchStats = async () => {
    const { data: ordersData } = await supabase.from('orders').select('status, total_amount');
    if (ordersData) {
      const totalOrders = ordersData.length;
      const pendingOrders = ordersData.filter(o => o.status === 'pending' || o.status === 'confirmed' || o.status === 'out_for_delivery').length;
      const deliveredOrders = ordersData.filter(o => o.status === 'delivered').length;
      const revenue = ordersData.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total_amount), 0);
      setStats({ totalOrders, pendingOrders, deliveredOrders, revenue });
    }
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price || !productForm.category_id) {
      toast.error('Please fill all required fields');
      return;
    }

    const productData = {
      name: productForm.name,
      description: productForm.description || null,
      price: parseFloat(productForm.price),
      stock_quantity: parseInt(productForm.stock_quantity) || 0,
      unit: productForm.unit,
      category_id: productForm.category_id,
      image_url: productForm.image_url || null,
      is_active: true
    };

    if (editingProduct) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingProduct.id);
      if (error) {
        toast.error('Failed to update product');
      } else {
        toast.success('Product updated successfully');
        resetForm();
        fetchProducts();
      }
    } else {
      const { error } = await supabase.from('products').insert(productData);
      if (error) {
        toast.error('Failed to create product');
      } else {
        toast.success('Product created successfully');
        resetForm();
        fetchProducts();
      }
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock_quantity: product.stock_quantity?.toString() || '0',
      unit: product.unit || 'piece',
      category_id: product.category_id || '',
      image_url: product.image_url || ''
    });
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product deleted successfully');
      fetchProducts();
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      price: '',
      stock_quantity: '',
      unit: 'piece',
      category_id: '',
      image_url: ''
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleApplicationAction = async (applicationId: string, action: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('delivery_applications')
      .update({ status: action })
      .eq('id', applicationId);

    if (error) {
      toast.error(`Failed to ${action === 'approved' ? 'approve' : 'reject'} application`);
      return;
    }

    // If approved, add delivery role to user
    if (action === 'approved') {
      const application = deliveryApplications.find(app => app.id === applicationId);
      if (application) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: application.user_id, role: 'delivery' });

        if (roleError) {
          console.error('Role assignment error:', roleError);
          toast.error('Application approved but failed to assign role');
        } else {
          toast.success('Application approved! User is now a delivery partner.');
        }
      }
    } else {
      toast.success('Application rejected');
    }

    fetchDeliveryApplications();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-foreground">{stats.totalOrders}</p>
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-foreground">{stats.pendingOrders}</p>
                <Package className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-foreground">{stats.deliveredOrders}</p>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-foreground">₹{stats.revenue.toFixed(2)}</p>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="delivery">Delivery Partners</TabsTrigger>
            <TabsTrigger value="malicious">Malicious Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={productForm.category_id} onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="price">Price (₹) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={productForm.stock_quantity}
                      onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      placeholder="piece, kg, ltr"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image">Image URL</Label>
                    <Input
                      id="image"
                      value={productForm.image_url}
                      onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Product description"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProduct}>
                    {editingProduct ? 'Update Product' : 'Add Product'}
                  </Button>
                  {editingProduct && (
                    <Button onClick={resetForm} variant="outline">
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">₹{product.price} • Stock: {product.stock_quantity}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditProduct(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-foreground">Order #{order.id.slice(0, 8)}</h3>
                          <p className="text-sm text-muted-foreground">User: {order.user_id.slice(0, 8)}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.status === 'delivered' ? 'bg-primary/10 text-primary' :
                          order.status === 'cancelled' || order.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          'bg-accent/10 text-accent'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{order.delivery_address}</p>
                      <p className="text-lg font-bold text-foreground">₹{Number(order.total_amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Delivery Partner Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deliveryApplications.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No applications submitted yet</p>
                  ) : (
                    deliveryApplications.map((application) => (
                      <div key={application.id} className="p-4 border border-border rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{application.full_name}</h3>
                            <p className="text-sm text-muted-foreground">Phone: {application.phone}</p>
                            <p className="text-sm text-muted-foreground">Vehicle: {application.vehicle_type}</p>
                            {application.license_number && (
                              <p className="text-sm text-muted-foreground">License: {application.license_number}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Applied: {new Date(application.created_at).toLocaleString()}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            application.status === 'approved' ? 'bg-primary/10 text-primary' :
                            application.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                            'bg-accent/10 text-accent'
                          }`}>
                            {application.status}
                          </span>
                        </div>
                        {application.status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => handleApplicationAction(application.id, 'approved')}
                              className="flex-1"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApplicationAction(application.id, 'rejected')}
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="malicious" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Malicious Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {maliciousActivities.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No malicious activities detected</p>
                  ) : (
                    maliciousActivities.map((activity) => (
                      <div key={activity.id} className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-foreground">{activity.activity_type}</h3>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.detected_at || '').toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {activity.user_id && <span>User ID: {activity.user_id.slice(0, 8)}...</span>}
                          {activity.delivery_person_id && <span>Delivery: {activity.delivery_person_id.slice(0, 8)}...</span>}
                          {activity.order_id && <span>Order ID: {activity.order_id.slice(0, 8)}...</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
