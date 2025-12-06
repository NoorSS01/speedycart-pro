import { useState, useEffect, useCallback } from 'react';
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
  XCircle,
  Calendar,
  Boxes,
  Megaphone
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import AdminBottomNav from '@/components/AdminBottomNav';
import PullToRefresh from '@/components/PullToRefresh';

type DateRange = 'today' | '7days' | '1month' | '6months' | '1year';

const getDateRangeStart = (range: DateRange): Date => {
  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case '7days':
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case '1month':
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case '6months':
      start.setMonth(now.getMonth() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case '1year':
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return start;
};

const dateRangeLabels: Record<DateRange, string> = {
  'today': 'Today',
  '7days': 'Last 7 Days',
  '1month': 'Last 1 Month',
  '6months': 'Last 6 Months',
  '1year': 'Last 1 Year'
};

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
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [maliciousActivities, setMaliciousActivities] = useState<MaliciousActivity[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; phone: string | null }>>({});
  const [deliveryApplications, setDeliveryApplications] = useState<DeliveryApplication[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    revenue: 0,
    commissionDeveloper: 0,
    commissionDelivery: 0,
    profit: 0
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
  const [dateRange, setDateRange] = useState<DateRange>('today');

  // Check admin access
  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // Wait for userRole to be loaded
    if (userRole === null) return;

    // Redirect non-admins to their appropriate page
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      switch (userRole) {
        case 'delivery':
          navigate('/delivery');
          break;
        default:
          navigate('/shop');
          break;
      }
      return;
    }

    fetchData();
    subscribeToChanges();
  }, [user, userRole, loading, navigate]);

  // Refetch data when date range changes
  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchStats();
    }
  }, [dateRange]);

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
    const startDate = getDateRangeStart(dateRange).toISOString();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setOrders(data);
  };

  const fetchMaliciousActivities = async () => {
    const { data } = await supabase
      .from('malicious_activities')
      .select('*')
      .order('detected_at', { ascending: false });
    if (data) {
      setMaliciousActivities(data);

      const profileIds = Array.from(
        new Set(
          data
            .flatMap((activity) => [activity.user_id, activity.delivery_person_id])
            .filter((id): id is string => Boolean(id))
        )
      );

      if (profileIds.length === 0) {
        setProfiles({});
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', profileIds);

      if (!profilesError && profilesData) {
        const profileMap: Record<string, { full_name: string | null; phone: string | null }> = {};
        profilesData.forEach((profile: any) => {
          profileMap[profile.id] = {
            full_name: profile.full_name ?? null,
            phone: profile.phone ?? null
          };
        });
        setProfiles(profileMap);
      }
    }
  };

  const fetchDeliveryApplications = async () => {
    const { data } = await supabase
      .from('delivery_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDeliveryApplications(data);
  };

  const fetchStats = async () => {
    const startDate = getDateRangeStart(dateRange).toISOString();
    const { data: ordersData } = await supabase
      .from('orders')
      .select('status, total_amount, created_at')
      .gte('created_at', startDate);

    if (ordersData) {
      const totalOrders = ordersData.length;
      const pendingOrders = ordersData.filter(o => o.status === 'pending' || o.status === 'confirmed' || o.status === 'out_for_delivery').length;
      const deliveredOrders = ordersData.filter(o => o.status === 'delivered').length;
      const revenue = ordersData.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total_amount), 0);
      const commissionDeveloper = deliveredOrders * 4; // ₹4 per delivered order to website builder
      const commissionDelivery = deliveredOrders * 5;  // ₹5 per delivered order to delivery partners
      const profit = revenue - commissionDeveloper - commissionDelivery;

      setStats({
        totalOrders,
        pendingOrders,
        deliveredOrders,
        revenue,
        commissionDeveloper,
        commissionDelivery,
        profit
      });
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

  // Show loading while checking auth
  if (loading || userRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="flex flex-col items-center gap-3">
          <Package className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render if not admin (redirect will happen)
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  {dateRangeLabels[dateRange]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
                  <SelectTrigger className="w-[130px] md:w-[160px] bg-background/60">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="1month">Last 1 Month</SelectItem>
                    <SelectItem value="6months">Last 6 Months</SelectItem>
                    <SelectItem value="1year">Last 1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <NotificationBell />

              <Button onClick={handleLogout} variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <PullToRefresh onRefresh={async () => { await fetchData(); }} className="min-h-[calc(100vh-80px)]">
        <main className="container mx-auto px-4 py-6">

          {/* Stats Carousel on Mobile, Grid on Desktop */}
          <div className="flex overflow-x-auto pb-6 -mx-4 px-4 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 lg:grid-cols-6 md:overflow-visible md:pb-0 md:mx-0 md:px-0 mb-6 scrollbar-hide">
            {/* Revenue */}
            <Card className="min-w-[260px] snap-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                  💰 Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-800 dark:text-green-300">₹{stats.revenue.toFixed(0)}</p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">Money from delivered orders</p>
              </CardContent>
            </Card>

            {/* Profit */}
            <Card className="min-w-[260px] snap-center bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  📈 Your Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">₹{stats.profit.toFixed(0)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">After paying ₹9/order commission</p>
              </CardContent>
            </Card>

            {/* To Pay */}
            <Card
              className="min-w-[260px] snap-center bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-lg transition"
              onClick={() => navigate('/admin/to-pay')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  💳 Pending Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">₹{(stats.commissionDeveloper + stats.commissionDelivery).toFixed(0)}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Tap to see details →</p>
              </CardContent>
            </Card>

            {/* Total Orders */}
            <Card className="min-w-[260px] snap-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  📦 All Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.totalOrders}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Total orders received</p>
              </CardContent>
            </Card>

            {/* Pending Orders */}
            <Card className={`min-w-[260px] snap-center bg-gradient-to-br ${stats.pendingOrders > 0 ? 'from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/20 border-orange-300 dark:border-orange-700' : 'from-gray-50 to-gray-100 dark:from-gray-950/40 dark:to-gray-900/20 border-gray-200 dark:border-gray-800'}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium flex items-center gap-2 ${stats.pendingOrders > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  ⏳ In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${stats.pendingOrders > 0 ? 'text-orange-800 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'}`}>{stats.pendingOrders}</p>
                <p className={`text-xs mt-1 ${stats.pendingOrders > 0 ? 'text-orange-600 dark:text-orange-500' : 'text-gray-500 dark:text-gray-500'}`}>Being processed/delivered</p>
              </CardContent>
            </Card>

            {/* Delivered */}
            <Card className="min-w-[260px] snap-center bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                  ✅ Delivered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{stats.deliveredOrders}</p>
                <p className="text-xs text-primary/70 mt-1">Successfully completed</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="space-y-4">
            <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 scrollbar-hide">
              <TabsList className="w-auto inline-flex md:grid md:w-full md:grid-cols-4 h-auto p-1">
                <TabsTrigger value="products" className="px-4 py-2">Products</TabsTrigger>
                <TabsTrigger value="orders" className="px-4 py-2">Orders</TabsTrigger>
                <TabsTrigger value="delivery" className="px-4 py-2">Delivery Partners</TabsTrigger>
                <TabsTrigger value="malicious" className="px-4 py-2">Malicious Activity</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="products" className="space-y-4">
              {/* Add Product Button */}
              <Button
                onClick={() => navigate('/admin/add-product')}
                className="w-full h-14 text-base font-semibold shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Product
              </Button>

              {/* Products List */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>All Products</span>
                    <span className="text-sm font-normal text-muted-foreground">{products.length} items</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/50">
                    {products.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0 border border-border/40">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <Package className="h-5 w-5 text-primary/60" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-primary">₹{product.price}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className={`${product.stock_quantity <= 5 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                {product.stock_quantity} in stock
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 ml-2">
                          <Button size="icon" variant="ghost" className="h-9 w-9 hover:bg-primary/10" onClick={() => handleEditProduct(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 hover:bg-destructive/10 text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {products.length === 0 && (
                      <div className="p-8 text-center">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">No products yet</p>
                        <Button onClick={() => navigate('/admin/add-product')} variant="link" className="mt-2">
                          Add your first product
                        </Button>
                      </div>
                    )}
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === 'delivered' ? 'bg-primary/10 text-primary' :
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
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${application.status === 'approved' ? 'bg-primary/10 text-primary' :
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
                          <p className="text-sm text-muted-foreground mb-3">{activity.description}</p>
                          {(() => {
                            const relatedOrder = orders.find((order) => order.id === activity.order_id);
                            const deliveryProfile = activity.delivery_person_id
                              ? profiles[activity.delivery_person_id]
                              : undefined;
                            const customerProfile = activity.user_id
                              ? profiles[activity.user_id]
                              : undefined;

                            return (
                              <div className="space-y-1 text-xs text-muted-foreground">
                                {relatedOrder && (
                                  <p>
                                    <span className="font-medium">Order:</span>{' '}
                                    Order #{relatedOrder.id.slice(0, 8)} • ₹
                                    {Number(relatedOrder.total_amount).toFixed(2)} •{' '}
                                    <span className="capitalize">{relatedOrder.status.replace('_', ' ')}</span>
                                  </p>
                                )}
                                {!relatedOrder && activity.order_id && (
                                  <p>
                                    <span className="font-medium">Order:</span>{' '}
                                    Order #{activity.order_id.slice(0, 8)}
                                  </p>
                                )}
                                {customerProfile && (
                                  <p>
                                    <span className="font-medium">Customer:</span>{' '}
                                    {customerProfile.full_name || 'Unknown customer'}
                                    {customerProfile.phone && ` (${customerProfile.phone})`}
                                  </p>
                                )}
                                {!customerProfile && activity.user_id && (
                                  <p>
                                    <span className="font-medium">Customer:</span>{' '}
                                    Unknown customer
                                  </p>
                                )}
                                {deliveryProfile && activity.delivery_person_id && (
                                  <p>
                                    <span className="font-medium">Delivery Person:</span>{' '}
                                    {deliveryProfile.full_name || 'Unknown delivery partner'}
                                    {deliveryProfile.phone && ` (${deliveryProfile.phone})`}
                                  </p>
                                )}
                                {!deliveryProfile && activity.delivery_person_id && (
                                  <p>
                                    <span className="font-medium">Delivery Person:</span>{' '}
                                    Unknown delivery partner
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </PullToRefresh>

      {/* Admin Bottom Navigation */}
      <AdminBottomNav />
    </div>
  );
}
