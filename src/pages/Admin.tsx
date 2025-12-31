import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ShoppingCart,
  DollarSign,
  Activity,
  Wallet,
  PackageCheck,
  Truck,
  Package,
  Clock,
  Calendar,
  Plus,
  Users,
  CreditCard,
  AlertCircle,
  AlertTriangle,
  Shield,
  Boxes,
  ChevronRight,
  User,
  Zap,
  Image,
  Layers
} from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type DateRange = 'today' | '7days' | '30days' | 'all';

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
    case '30days':
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all':
    default:
      return new Date(0); // Beginning of time
  }
  return start;
};

const dateRangeLabels: Record<DateRange, string> = {
  'today': 'Today',
  '7days': '7 Days',
  '30days': '30 Days',
  'all': 'All Time'
};

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  user_id: string;
}

export default function Admin() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [pendingApplications, setPendingApplications] = useState(0);

  // Auth Check
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (userRole === null) return;

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
  }, [user, userRole, authLoading, navigate, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch orders with date filter
      const startDate = getDateRangeStart(dateRange).toISOString();

      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateRange !== 'all') {
        query = query.gte('created_at', startDate);
      }

      const { data: ordersData, error } = await query;
      if (error) throw error;
      setOrders(ordersData || []);

      // Fetch pending delivery applications
      const { data: appsData } = await supabase
        .from('delivery_applications')
        .select('status')
        .eq('status', 'pending');

      setPendingApplications(appsData?.length || 0);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed' || o.status === 'out_for_delivery');

    const revenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const commissionDeveloper = deliveredOrders.length * 4;
    const commissionDelivery = deliveredOrders.length * 5;
    const totalExpenses = commissionDeveloper + commissionDelivery;
    const profit = revenue - totalExpenses;

    return {
      totalOrders: orders.length,
      pendingOrders: pendingOrders.length,
      deliveredOrders: deliveredOrders.length,
      revenue,
      profit,
      commissionDeveloper,
      commissionDelivery
    };
  }, [orders]);

  // Loading State
  if (authLoading || userRole === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        </main>
        <AdminBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
              onClick={() => navigate('/admin/profile')}
            >
              <User className="h-5 w-5 text-primary" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Package className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Admin</h1>
                <p className="text-[10px] text-muted-foreground">Dashboard</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/admin/add-product')}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Date Range Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          {(Object.keys(dateRangeLabels) as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
              className="shrink-0"
            >
              {dateRangeLabels[range]}
            </Button>
          ))}
        </div>

        {/* Pending Applications Alert */}
        {pendingApplications > 0 && (
          <Card
            className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin/delivery-apps')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Delivery Applications</p>
                    <p className="text-xs text-muted-foreground">{pendingApplications} pending review</p>
                  </div>
                </div>
                <Badge className="bg-amber-500">{pendingApplications}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Net Profit"
            value={`₹${stats.profit.toLocaleString()}`}
            icon={Wallet}
            color="emerald"
            loading={loading}
          />
          <StatCard
            title="Revenue"
            value={`₹${stats.revenue.toLocaleString()}`}
            icon={DollarSign}
            color="blue"
            loading={loading}
          />
          <StatCard
            title="Total Orders"
            value={stats.totalOrders.toString()}
            icon={ShoppingCart}
            color="purple"
            loading={loading}
          />
          <StatCard
            title="Pending"
            value={stats.pendingOrders.toString()}
            icon={Clock}
            color="amber"
            alert={stats.pendingOrders > 0}
            loading={loading}
          />
        </div>

        {/* Second Row - Delivered & Payments */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Delivered"
            value={stats.deliveredOrders.toString()}
            icon={PackageCheck}
            color="emerald"
            loading={loading}
          />
          <Card
            className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/20 dark:to-slate-900 border-rose-100 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin/to-pay')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/40">
                  <CreditCard className="w-5 h-5 text-rose-600" />
                </div>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Payments</p>
              {loading ? (
                <Skeleton className="h-7 w-20 mt-1" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-rose-600">
                  ₹{stats.commissionDeveloper + stats.commissionDelivery}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Tap to pay →</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tools */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Admin Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {/* Delivery Applications */}
            <button
              onClick={() => navigate('/admin/delivery-apps')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 border border-blue-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Delivery Apps</p>
                <p className="text-xs text-muted-foreground truncate">Review applications</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Products */}
            <button
              onClick={() => navigate('/admin/stock')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 border border-emerald-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                <Boxes className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Products</p>
                <p className="text-xs text-muted-foreground truncate">Manage inventory</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Promotional Banners */}
            <button
              onClick={() => navigate('/admin/banners')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-900 border border-orange-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Banners</p>
                <p className="text-xs text-muted-foreground truncate">Promotional offers</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Coupon Triggers */}
            <button
              onClick={() => navigate('/admin/coupon-triggers')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-900/20 dark:to-slate-900 border border-yellow-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg">
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Coupon Triggers</p>
                <p className="text-xs text-muted-foreground truncate">Automatic discounts</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Hero Banners */}
            <button
              onClick={() => navigate('/admin/hero-banners')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900 border border-purple-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                <Image className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Hero Banners</p>
                <p className="text-xs text-muted-foreground truncate">Large homepage banners</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Offer Sections */}
            <button
              onClick={() => navigate('/admin/offer-sections')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/20 dark:to-slate-900 border border-pink-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-pink-100 dark:bg-pink-900/40 rounded-lg">
                <Layers className="w-5 h-5 text-pink-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Offer Sections</p>
                <p className="text-xs text-muted-foreground truncate">50% OFF zones, etc.</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Flash Deals */}
            <button
              onClick={() => navigate('/admin/flash-deals')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 border border-amber-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Flash Deals</p>
                <p className="text-xs text-muted-foreground truncate">Time-limited offers</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Malicious Activity */}
            <button
              onClick={() => navigate('/admin/security')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-slate-900 border border-red-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Security</p>
                <p className="text-xs text-muted-foreground truncate">Malicious activity</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* User Management */}
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-3 p-3 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900 border border-purple-100 rounded-xl text-left hover:shadow-md transition-shadow"
            >
              <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Users</p>
                <p className="text-xs text-muted-foreground truncate">Manage roles</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Delivery Time Setting */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Delivery Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Delivery Time Limit</p>
                <p className="text-xs text-muted-foreground">Max time for each delivery</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="border rounded-lg px-3 py-2 text-sm bg-background"
                  defaultValue={localStorage.getItem('delivery_time_minutes') || '30'}
                  onChange={(e) => {
                    localStorage.setItem('delivery_time_minutes', e.target.value);
                    toast.success(`Delivery time set to ${e.target.value} minutes`);
                  }}
                >
                  <option value="15">15 min</option>
                  <option value="20">20 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
            ) : orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No orders yet</p>
            ) : (
              orders.slice(0, 5).map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => navigate('/admin/orders')}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white
                      ${order.status === 'delivered' ? 'bg-emerald-500' :
                        order.status === 'pending' ? 'bg-amber-500' :
                          order.status === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'}
                    `}>
                      {order.status === 'delivered' ? <PackageCheck className="w-5 h-5" /> :
                        order.status === 'pending' ? <Clock className="w-5 h-5" /> :
                          <Activity className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{order.total_amount}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize
                        ${order.status === 'delivered' ? 'border-emerald-500 text-emerald-600' :
                          order.status === 'pending' ? 'border-amber-500 text-amber-600' :
                            order.status === 'cancelled' ? 'border-red-500 text-red-600' :
                              'border-blue-500 text-blue-600'}
                      `}
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <AdminBottomNav />
    </div>
  );
}

// Simple Stat Card Component
function StatCard({ title, value, icon: Icon, color, alert, loading }: {
  title: string;
  value: string;
  icon: any;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
  alert?: boolean;
  loading?: boolean;
}) {
  const colorClasses = {
    emerald: 'from-emerald-50 to-white dark:from-emerald-900/20 border-emerald-100 text-emerald-600',
    blue: 'from-blue-50 to-white dark:from-blue-900/20 border-blue-100 text-blue-600',
    purple: 'from-purple-50 to-white dark:from-purple-900/20 border-purple-100 text-purple-600',
    amber: 'from-amber-50 to-white dark:from-amber-900/20 border-amber-100 text-amber-600',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} dark:to-slate-900`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-xl bg-${color}-100 dark:bg-${color}-900/40`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
          </div>
          {alert && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
