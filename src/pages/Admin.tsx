import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Activity,
  CalendarRange,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PackageCheck,
  Truck
} from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

// Types
interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  user_id: string;
  profiles?: { full_name: string | null } | null;
}

type DateRange = 'today' | '7days' | '30days' | 'year';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function Admin() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7days');

  useEffect(() => {
    if (!authLoading && (!user || (userRole !== 'admin' && userRole !== 'super_admin'))) {
      navigate('/auth');
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      switch (dateRange) {
        case 'today': startDate = startOfDay(now); break;
        case '7days': startDate = subDays(now, 7); break;
        case '30days': startDate = subDays(now, 30); break;
        case 'year': startDate = subDays(now, 365); break;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*, profiles(full_name)')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) setOrders(data);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const { chartData, pieData, summary } = useMemo(() => {
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const pendingOrders = orders.filter(o => o.status === 'pending');

    // Financials
    const revenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const commissionDeveloper = deliveredOrders.length * 4;
    const commissionDelivery = deliveredOrders.length * 5;
    const totalExpenses = commissionDeveloper + commissionDelivery;
    const profit = revenue - totalExpenses;

    // Date Aggregation for Chart
    const dateMap = new Map();
    if (dateRange !== 'today') {
      const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 12;
      for (let i = 0; i < days; i++) {
        const d = subDays(new Date(), i);
        const key = format(d, 'MMM dd');
        dateMap.set(key, { name: key, revenue: 0, profit: 0 });
      }
    }

    orders.forEach(order => {
      if (order.status !== 'delivered') return;
      const date = new Date(order.created_at);
      const key = format(date, 'MMM dd');

      if (dateRange === 'today') {
        const hourKey = format(date, 'HH:00');
        if (!dateMap.has(hourKey)) dateMap.set(hourKey, { name: hourKey, revenue: 0, profit: 0 });
        const amt = Number(order.total_amount);
        dateMap.get(hourKey).revenue += amt;
        dateMap.get(hourKey).profit += (amt - 9); // approx profit per order logic applied per item for chart
      } else {
        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          const amt = Number(order.total_amount);
          entry.revenue += amt;
          entry.profit += (amt - 9);
        }
      }
    });

    const chartDataArray = Array.from(dateMap.values()).reverse();

    // Pie Chart
    const statusCounts: Record<string, number> = {};
    orders.forEach(o => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    const pieDataArray = Object.keys(statusCounts).map(status => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: statusCounts[status]
    }));

    return {
      chartData: dateRange === 'today' ? Array.from(dateMap.values()) : chartDataArray,
      pieData: pieDataArray,
      summary: {
        revenue,
        profit,
        orders: orders.length,
        pending: pendingOrders.length,
        delivered: deliveredOrders.length,
        commissionDeveloper,
        commissionDelivery
      }
    };

  }, [orders, dateRange]);

  if (authLoading) return <AdminLayout><div className="flex justify-center p-8"><Skeleton className="w-full h-96" /></div></AdminLayout>;

  return (
    <AdminLayout title="Dashboard">
      <div className="flex justify-between md:justify-end mb-6 items-center">
        <h2 className="md:hidden text-lg font-semibold">Overview</h2>
        <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
          <SelectTrigger className="w-[140px] md:w-[180px] bg-white dark:bg-slate-900 shadow-sm">
            <CalendarRange className="w-4 h-4 mr-2 text-slate-500" />
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
        <StatsCard
          title="Net Profit"
          value={`₹${summary.profit.toLocaleString()}`}
          icon={Wallet}
          trend="Actual Earnings"
          trendUp={true}
          color="text-emerald-600"
          bg="bg-emerald-50 dark:bg-emerald-900/20"
          loading={loading}
        />
        <StatsCard
          title="Total Revenue"
          value={`₹${summary.revenue.toLocaleString()}`}
          icon={DollarSign}
          trend="Gross Volume"
          trendUp={true}
          color="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-900/20"
          loading={loading}
        />
        <StatsCard
          title="Delivered"
          value={summary.delivered.toString()}
          icon={PackageCheck}
          trend="Successful Orders"
          trendUp={true}
          color="text-purple-600"
          bg="bg-purple-50 dark:bg-purple-900/20"
          loading={loading}
        />
        <StatsCard
          title="Pending"
          value={summary.pending.toString()}
          icon={Activity}
          trend="Needs Attention"
          trendUp={summary.pending === 0} // Up is good if 0 pending? Or bad? Let's say if > 0 alert
          alert={summary.pending > 0}
          color="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-900/20"
          loading={loading}
        />
      </div>

      {/* Secondary Stats (Commissions) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-slate-200/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Developer Commission</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">₹{summary.commissionDeveloper}</h3>
              <p className="text-xs text-slate-400 mt-1">₹4 per delivered order</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-slate-200/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Delivery Commission</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">₹{summary.commissionDelivery}</h3>
              <p className="text-xs text-slate-400 mt-1">₹5 per delivered order</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-full text-rose-600">
              <Truck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 border-slate-200/60 shadow-sm">
          <CardHeader>
            <CardTitle>Profit & Revenue</CardTitle>
            <CardDescription>Financial performance over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#colorProfit)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 shadow-sm">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Real-time distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {loading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Recent Activities</h3>
          <Button variant="link" onClick={() => navigate('/orders')}>View All</Button>
        </div>
        {orders.slice().reverse().slice(0, 5).map(order => (
          <div key={order.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                                ${order.status === 'delivered' ? 'bg-emerald-500' :
                  order.status === 'pending' ? 'bg-amber-500' : 'bg-slate-500'
                }`}>
                {order.status === 'delivered' ? <PackageCheck className="w-5 h-5" /> :
                  order.status === 'pending' ? <Activity className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">order #{order.id.slice(0, 6)}</p>
                <p className="text-xs text-slate-500">{format(new Date(order.created_at), 'MMM dd, HH:mm')}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold">₹{order.total_amount}</p>
              <Badge variant="outline" className="capitalize text-[10px]">{order.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

// Optimized Stats Card
function StatsCard({ title, value, icon: Icon, trend, trendUp, alert, color, bg, loading }: any) {
  return (
    <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-2xl ${bg}`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
          {alert && (
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{title}</h3>
          {loading ? (
            <Skeleton className="h-8 w-24 rounded-lg" />
          ) : (
            <div className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {value}
            </div>
          )}
          <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1">
            {trendUp ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : <ArrowDownRight className="w-3 h-3 text-rose-500" />}
            {trend}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
