import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PackageCheck,
  Truck,
  Package,
  Clock
} from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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

    fetchOrders();
  }, [user, userRole, authLoading, navigate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const pendingOrders = orders.filter(o => o.status === 'pending');

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Business Overview</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Primary Stats Grid - Profit, Revenue, Delivered, Pending */}
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
            title="Delivered"
            value={stats.deliveredOrders.toString()}
            icon={PackageCheck}
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

        {/* Commission Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 border-indigo-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dev Commission</p>
                  <p className="text-lg font-bold">₹{stats.commissionDeveloper}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/20 dark:to-slate-900 border-rose-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/40 rounded-xl">
                  <Truck className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delivery Commission</p>
                  <p className="text-lg font-bold">₹{stats.commissionDelivery}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
                  onClick={() => navigate('/orders')}
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
