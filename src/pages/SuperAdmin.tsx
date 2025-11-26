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
  Shield,
  Edit,
  Trash2,
  Plus,
  Truck,
  Minus
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin' | 'delivery' | 'super_admin';
  created_at: string;
}

interface DeliveryApplication {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  license_number: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function SuperAdmin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [maliciousActivities, setMaliciousActivities] = useState<MaliciousActivity[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [deliveryApplications, setDeliveryApplications] = useState<DeliveryApplication[]>([]);
  const [stats, setStats] = useState({ 
    totalOrders: 0, 
    pendingOrders: 0, 
    deliveredOrders: 0, 
    revenue: 0,
    totalUsers: 0,
    deliveryPersons: 0,
    pendingApplications: 0
  });
  
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

  const [roleManagement, setRoleManagement] = useState<{
    userId: string;
    newRole: 'user' | 'admin' | 'delivery' | 'super_admin';
  }>({
    userId: '',
    newRole: 'user'
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'product' | 'role' | null;
    id: string;
    name: string;
  }>({
    open: false,
    type: null,
    id: '',
    name: ''
  });

  useEffect(() => {
    const hasSuperAdminAccess = sessionStorage.getItem('superadmin_access') === 'true';
    if (!user && !hasSuperAdminAccess) {
      navigate('/auth');
      return;
    }
    fetchData();
    subscribeToChanges();
  }, [user, navigate]);

  const subscribeToChanges = () => {
    const ordersChannel = supabase
      .channel('superadmin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    const maliciousChannel = supabase
      .channel('superadmin-malicious')
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
      fetchUserRoles(),
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

  const fetchUserRoles = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setUserRoles(data);
  };

  const fetchDeliveryApplications = async () => {
    const { data } = await supabase
      .from('delivery_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDeliveryApplications(data as DeliveryApplication[]);
  };

  const fetchStats = async () => {
    const { data: ordersData } = await supabase.from('orders').select('status, total_amount');
    const { data: rolesData } = await supabase.from('user_roles').select('role');
    const { data: appsData } = await supabase.from('delivery_applications').select('status');
    
    if (ordersData) {
      const totalOrders = ordersData.length;
      const pendingOrders = ordersData.filter(o => o.status === 'pending' || o.status === 'confirmed' || o.status === 'out_for_delivery').length;
      const deliveredOrders = ordersData.filter(o => o.status === 'delivered').length;
      const revenue = ordersData.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total_amount), 0);
      
      const totalUsers = rolesData?.filter(r => r.role === 'user').length || 0;
      const deliveryPersons = rolesData?.filter(r => r.role === 'delivery').length || 0;
      const pendingApplications = appsData?.filter(a => a.status === 'pending').length || 0;
      
      setStats({ totalOrders, pendingOrders, deliveredOrders, revenue, totalUsers, deliveryPersons, pendingApplications });
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

  const handleDeleteProduct = async (id: string, name: string) => {
    setDeleteDialog({ open: true, type: 'product', id, name });
  };

  const handleUpdateStock = async (productId: string, currentStock: number, change: number) => {
    const newStock = Math.max(0, currentStock + change);
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);
    
    if (error) {
      toast.error('Failed to update stock');
    } else {
      toast.success('Stock updated successfully');
      fetchProducts();
    }
  };

  const handleApplicationAction = async (appId: string, userId: string, action: 'approved' | 'rejected') => {
    const { error: updateError } = await supabase
      .from('delivery_applications')
      .update({ status: action })
      .eq('id', appId);

    if (updateError) {
      toast.error('Failed to update application');
      return;
    }

    if (action === 'approved') {
      // Use upsert to handle both insert and update cases
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, role: 'delivery' },
          { onConflict: 'user_id,role' }
        );

      if (roleError) {
        toast.error('Failed to assign delivery role');
        return;
      }
    }

    toast.success(`Application ${action} successfully`);
    fetchDeliveryApplications();
    fetchStats();
    fetchUserRoles();
  };

  const handleAddRole = async () => {
    if (!roleManagement.userId) {
      toast.error('Please enter a user ID');
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({ 
        user_id: roleManagement.userId, 
        role: roleManagement.newRole 
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('User already has this role');
      } else {
        toast.error('Failed to add role: ' + error.message);
      }
    } else {
      toast.success('Role added successfully');
      setRoleManagement({ userId: '', newRole: 'user' });
      fetchUserRoles();
      fetchStats();
    }
  };

  const handleDeleteRole = async (roleId: string, userId: string) => {
    setDeleteDialog({ open: true, type: 'role', id: roleId, name: userId });
  };

  const confirmDelete = async () => {
    if (deleteDialog.type === 'product') {
      const { error } = await supabase.from('products').delete().eq('id', deleteDialog.id);
      if (error) {
        toast.error('Failed to delete product: ' + error.message);
      } else {
        toast.success('Product deleted successfully');
        fetchProducts();
      }
    } else if (deleteDialog.type === 'role') {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', deleteDialog.id);

      if (error) {
        toast.error('Failed to delete role: ' + error.message);
      } else {
        toast.success('Role removed successfully');
        fetchUserRoles();
        fetchStats();
      }
    }
    setDeleteDialog({ open: false, type: null, id: '', name: '' });
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
    sessionStorage.removeItem('superadmin_access');
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Full system control & management</p>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">{stats.pendingOrders}</p>
                <Package className="h-6 w-6 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">{stats.deliveredOrders}</p>
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">₹{stats.revenue.toFixed(0)}</p>
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
                <Users className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">{stats.deliveryPersons}</p>
                <Truck className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-foreground">{stats.pendingApplications}</p>
                <Plus className="h-6 w-6 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="applications">
              Delivery Apps
              {stats.pendingApplications > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                  {stats.pendingApplications}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
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
                <CardTitle>All Products ({products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center gap-4 p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">₹{product.price} • {product.unit}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">Stock</span>
                          <div className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => handleUpdateStock(product.id, product.stock_quantity, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-semibold min-w-[2rem] text-center">{product.stock_quantity}</span>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => handleUpdateStock(product.id, product.stock_quantity, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleEditProduct(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(product.id, product.name)}>
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

          <TabsContent value="applications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Delivery Partner Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deliveryApplications.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No applications yet</p>
                  ) : (
                    deliveryApplications.map((app) => (
                      <div key={app.id} className={`p-4 border rounded-lg ${
                        app.status === 'pending' ? 'border-accent bg-accent/5' :
                        app.status === 'approved' ? 'border-primary/20 bg-primary/5' :
                        'border-destructive/20 bg-destructive/5'
                      }`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-foreground">{app.full_name}</h3>
                            <p className="text-sm text-muted-foreground">Phone: {app.phone}</p>
                            <p className="text-sm text-muted-foreground">Vehicle: {app.vehicle_type}</p>
                            {app.license_number && (
                              <p className="text-sm text-muted-foreground">License: {app.license_number}</p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            app.status === 'pending' ? 'bg-accent text-accent-foreground' :
                            app.status === 'approved' ? 'bg-primary text-primary-foreground' :
                            'bg-destructive text-destructive-foreground'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">
                          Applied: {new Date(app.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">
                          User ID: {app.user_id}
                        </div>
                        {app.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApplicationAction(app.id, app.user_id, 'approved')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApplicationAction(app.id, app.user_id, 'rejected')}
                            >
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

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  User Role Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      value={roleManagement.userId}
                      onChange={(e) => setRoleManagement({ ...roleManagement, userId: e.target.value })}
                      placeholder="Enter user ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newRole">New Role</Label>
                    <Select value={roleManagement.newRole} onValueChange={(value) => setRoleManagement({ ...roleManagement, newRole: value as 'user' | 'admin' | 'delivery' | 'super_admin' })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAddRole}>Add Role</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {userRoles.map((userRole) => (
                    <div key={userRole.id} className="p-4 border border-border rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            User #{userRole.user_id.slice(0, 8)}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">ID: {userRole.user_id}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            userRole.role === 'super_admin' ? 'bg-destructive/10 text-destructive' :
                            userRole.role === 'admin' ? 'bg-accent/10 text-accent' :
                            userRole.role === 'delivery' ? 'bg-primary/10 text-primary' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {userRole.role}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRole(userRole.id, userRole.user_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, type: null, id: '', name: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === 'product' 
                ? `This will permanently delete the product "${deleteDialog.name}". This action cannot be undone.`
                : `This will remove the role for user "${deleteDialog.name.slice(0, 8)}...". This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
