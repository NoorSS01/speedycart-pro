import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  TrendingUp,
  Users,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Activity,
  CalendarRange,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Package
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
  Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfDay } from 'date-fns';

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

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']; // Emerald, Blue, Amber, Red

export default function Admin() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [isLocked, setIsLocked] = useState(false);

  // Check Access
  useEffect(() => {
    if (!authLoading && (!user || (userRole !== 'admin' && userRole !== 'super_admin'))) {
      navigate('/auth');
    }
  }, [user, userRole, authLoading, navigate]);

  // Fetch Data
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
        .order('created_at', { ascending: true }); // Ascending for chart

      if (error) throw error;
      if (data) setOrders(data);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Stats & Chart Data
  const { chartData, pieData, summary } = useMemo(() => {
    if (!orders.length) return { chartData: [], pieData: [], summary: { revenue: 0, orders: 0, avgOrderValue: 0, pending: 0 } };

    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const avgVal = totalRevenue / orders.length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;

    const dateMap = new Map();

    // Initialize days for charts if not today
    if (dateRange !== 'today') {
      const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 12;
      for (let i = 0; i < days; i++) {
        const d = subDays(new Date(), i);
        const key = format(d, 'MMM dd');
        dateMap.set(key, { name: key, revenue: 0, orders: 0 });
      }
    }

    orders.forEach(order => {
      const date = new Date(order.created_at);
      const key = format(date, 'MMM dd');
      // If today, map by hour? For simplicity, we stick to days or just list points for today
      if (dateRange === 'today') {
        const hourKey = format(date, 'HH:00');
        if (!dateMap.has(hourKey)) dateMap.set(hourKey, { name: hourKey, revenue: 0, orders: 0 });
        dateMap.get(hourKey).revenue += Number(order.total_amount);
        dateMap.get(hourKey).orders += 1;
      } else {
        if (dateMap.has(key)) {
          const entry = dateMap.get(key);
          entry.revenue += Number(order.total_amount);
          entry.orders += 1;
        }
      }
    });

    const chartDataArray = Array.from(dateMap.values()).reverse(); // If initialized backward
    // Actually, if we initialized subDays(0), subDays(1)... that's reverse chrono.
    // We want chrono. So reverse it to get oldest first.

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
        revenue: totalRevenue,
        orders: orders.length,
        avgOrderValue: avgVal,
        pending: pendingCount
      }
    };

  }, [orders, dateRange]);

  if (authLoading) return <AdminLayout><div className="flex justify-center p-8"><Skeleton className="w-full h-96" /></div></AdminLayout>;

  return (
    <AdminLayout title="Dashboard">
      {/* Header Actions */}
      <div className="flex justify-between md:justify-end mb-6 items-center">
        <h2 className="md:hidden text-lg font-semibold">Overview</h2>
        <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
          <SelectTrigger className="w-[140px] md:w-[180px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
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

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <StatsCard
          title="Total Revenue"
          value={`₹${summary.revenue.toLocaleString()}`}
          icon={DollarSign}
          trend="vs previous"
          trendUp={true}
          color="text-emerald-500"
          loading={loading}
        />
        <StatsCard
          title="Total Orders"
          value={summary.orders.toString()}
          icon={ShoppingCart}
          trend="vs previous"
          trendUp={true}
          color="text-blue-500"
          loading={loading}
        />
        <StatsCard
          title="Avg. Order Value"
          value={`₹${summary.avgOrderValue.toFixed(0)}`}
          icon={CreditCard}
          trend="-2.1%"
          trendUp={false}
          color="text-purple-500"
          loading={loading}
        />
        <StatsCard
          title="Pending Orders"
          value={summary.pending.toString()}
          icon={Activity}
          trend="Action needed"
          trendUp={true}
          color={summary.pending > 0 ? "text-amber-500" : "text-slate-500"}
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Income over selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [`₹${value}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Pie */}
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Distribution of order states</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : (
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
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-4">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest transactions from users</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')} className="hover:bg-slate-100">View All</Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Order ID</th>
                    <th className="px-6 py-4 font-semibold">Customer</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white/40 dark:bg-slate-900/40">
                  {orders.slice().reverse().slice(0, 5).map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                            {(order.profiles?.full_name || 'G')[0]}
                          </div>
                          {order.profiles?.full_name || 'Guest'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        ₹{order.total_amount}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`
                                                    ${order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            order.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'}
                                                `}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="hover:bg-slate-200/50 rounded-full w-8 h-8 p-0" onClick={() => navigate(`/orders?id=${order.id}`)}>
                          <ArrowUpRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                        No orders found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

// KPI Card Component
function StatsCard({ title, value, icon: Icon, trend, trendUp, color, loading }: any) {
  return (
    <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl group cursor-pointer hover:-translate-y-1 duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 group-hover:scale-110 transition-transform duration-300 ${color?.replace('text-', 'bg-').replace('500', '50') || ''}`}>
            <Icon className={`w-6 h-6 ${color || 'text-slate-600'}`} />
          </div>
          {trend && (
            <div className={`flex items-center text-xs font-bold tracking-tight ${trendUp ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-slate-500 bg-slate-50'} px-2.5 py-1 rounded-full`}>
              {trendUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              {trend}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{title}</h3>
          {loading ? (
            <Skeleton className="h-8 w-24 rounded-lg" />
          ) : (
            <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">
              {value}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
