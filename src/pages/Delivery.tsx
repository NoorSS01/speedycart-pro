import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useDeliveryTime } from '@/hooks/useDeliveryTime';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LogOut,
  Package,
  CheckCircle,
  Truck,
  MapPin,
  Clock,
  PackageCheck,
  Navigation,
  AlertTriangle,
  Timer,
  ChevronRight,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface DeliveryOrder {
  id: string;
  order_id: string;
  assigned_at: string | null;
  marked_delivered_at: string | null;
  user_confirmed_at: string | null;
  is_rejected: boolean;
  orders: {
    id: string;
    total_amount: number;
    delivery_address: string;
    status: string;
    created_at: string;
  };
  orderNumber: number; // Platform-wide daily order number
}

export default function Delivery() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [earningsFilter, setEarningsFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const { deliveryTimeMinutes } = useDeliveryTime();

  // Timer update every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (userRole !== 'delivery' && userRole !== 'super_admin') {
      navigate('/');
      return;
    }
    fetchAssignments();

    const channel = supabase
      .channel('delivery-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, fetchAssignments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAssignments)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userRole, authLoading, navigate]);

  // SINGLE QUERY - NO EXTRA CALLS
  const fetchAssignments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get today's start
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Fetch ALL today's orders to calculate order numbers
      const { data: allTodayOrders } = await supabase
        .from('orders')
        .select('id, created_at')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true });

      // Create order number map (Order 1, Order 2, etc.)
      const orderNumberMap: Record<string, number> = {};
      (allTodayOrders || []).forEach((order, index) => {
        orderNumberMap[order.id] = index + 1;
      });

      // Fetch this delivery person's assignments
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select(`
          id, order_id, assigned_at, marked_delivered_at, user_confirmed_at, is_rejected,
          orders!inner (id, total_amount, delivery_address, status, created_at)
        `)
        .eq('delivery_person_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) {
        logger.error('Delivery assignments fetch error', { error });
        setAssignments([]);
      } else {
        // Add order numbers
        const enriched = (data || []).map((a: any) => ({
          ...a,
          is_rejected: a.is_rejected || false,
          orderNumber: orderNumberMap[a.orders.id] || 0
        }));
        setAssignments(enriched);
      }
    } catch (err) {
      logger.error('Exception fetching delivery data', { error: err });
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  // Timer calculation
  const getTimeInfo = (createdAt: string) => {
    const orderTime = new Date(createdAt);
    const deadlineTime = new Date(orderTime.getTime() + deliveryTimeMinutes * 60 * 1000);
    const remaining = Math.max(0, deadlineTime.getTime() - currentTime.getTime());
    const totalTime = deliveryTimeMinutes * 60 * 1000;
    const percentRemaining = (remaining / totalTime) * 100;

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const timeString = remaining > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : '0:00';

    let color: 'green' | 'yellow' | 'red';
    if (percentRemaining > 50) color = 'green';
    else if (percentRemaining > 25) color = 'yellow';
    else color = 'red';

    return { timeString, color, isExpired: remaining === 0 };
  };

  // Pick order
  const pickOrder = async (e: React.MouseEvent, assignmentId: string, orderId: string) => {
    e.stopPropagation();
    setActionLoading(assignmentId);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'out_for_delivery' })
      .eq('id', orderId);

    if (!error) {
      toast.success('Order picked up!');
      fetchAssignments();
    } else {
      toast.error('Failed');
    }
    setActionLoading(null);
  };

  // Mark delivered
  const markAsDelivered = async (e: React.MouseEvent, assignmentId: string) => {
    e.stopPropagation();
    setActionLoading(assignmentId);
    const { error } = await supabase
      .from('delivery_assignments')
      .update({ marked_delivered_at: new Date().toISOString(), is_rejected: false })
      .eq('id', assignmentId);

    if (!error) {
      toast.success('Marked as delivered!');
      fetchAssignments();
    } else {
      toast.error('Failed');
    }
    setActionLoading(null);
  };

  // Open maps
  const openMaps = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  // Navigate to order detail
  const viewOrderDetail = (orderId: string) => {
    navigate(`/delivery/order/${orderId}`);
  };

  // Categorize
  const newOrders = assignments.filter(a => !a.is_rejected && !a.marked_delivered_at && (a.orders.status === 'pending' || a.orders.status === 'confirmed'));
  const inTransit = assignments.filter(a => !a.is_rejected && !a.marked_delivered_at && a.orders.status === 'out_for_delivery');
  const awaiting = assignments.filter(a => !a.is_rejected && a.marked_delivered_at && !a.user_confirmed_at);
  const completed = assignments.filter(a => a.user_confirmed_at);
  const rejected = assignments.filter(a => a.is_rejected);

  // Stats with filter
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);
    monthStart.setHours(0, 0, 0, 0);

    // Today's deliveries
    const todayDone = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= todayStart).length;

    // Filtered earnings (₹5 per delivery)
    let filteredCompleted = completed;
    if (earningsFilter === 'today') {
      filteredCompleted = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= todayStart);
    } else if (earningsFilter === 'week') {
      filteredCompleted = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= weekStart);
    } else if (earningsFilter === 'month') {
      filteredCompleted = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= monthStart);
    }

    return {
      today: todayDone,
      delivered: completed.length,
      earnings: filteredCompleted.length * 5,
      earningsCount: filteredCompleted.length,
      pending: newOrders.length + inTransit.length
    };
  }, [completed, newOrders, inTransit, earningsFilter]);

  // Timer Badge
  const TimerBadge = ({ createdAt }: { createdAt: string }) => {
    const { timeString, color, isExpired } = getTimeInfo(createdAt);
    const colorClasses = {
      green: 'bg-emerald-100 text-emerald-700',
      yellow: 'bg-amber-100 text-amber-700',
      red: 'bg-red-100 text-red-700 animate-pulse'
    };
    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${colorClasses[color]}`}>
        <Timer className="w-3 h-3" />
        {isExpired ? 'LATE' : timeString}
      </div>
    );
  };

  // Order Card - Clickable
  const OrderCard = ({ a, type }: { a: DeliveryOrder; type: 'new' | 'transit' | 'await' | 'done' | 'rejected' }) => (
    <Card
      className="mb-3 border border-border/40 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => viewOrderDetail(a.order_id)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <p className="font-bold text-foreground">Order {a.orderNumber}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(a.orders.created_at), 'hh:mm a')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(type === 'new' || type === 'transit') && <TimerBadge createdAt={a.orders.created_at} />}
            <Badge className="bg-primary text-primary-foreground">₹{a.orders.total_amount}</Badge>
          </div>
        </div>

        {/* Address */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 flex items-start gap-2 p-2 bg-muted rounded-lg">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-tight line-clamp-2">{a.orders.delivery_address}</p>
          </div>
          <Button
            size="icon"
            className="h-10 w-10 bg-primary hover:bg-primary/90"
            onClick={(e) => openMaps(e, a.orders.delivery_address)}
          >
            <Navigation className="w-4 h-4" />
          </Button>
        </div>

        {/* Actions */}
        {type === 'new' && (
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={(e) => pickOrder(e, a.id, a.order_id)}
            disabled={actionLoading === a.id}
          >
            <Truck className="w-4 h-4 mr-2" />
            {actionLoading === a.id ? 'Picking...' : 'Pick Up'}
          </Button>
        )}

        {type === 'transit' && (
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={(e) => markAsDelivered(e, a.id)}
            disabled={actionLoading === a.id}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {actionLoading === a.id ? 'Marking...' : 'Mark Delivered'}
          </Button>
        )}

        {type === 'await' && (
          <div className="flex items-center justify-between p-2 bg-secondary rounded-lg">
            <span className="text-xs text-muted-foreground">Pending confirmation</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        {type === 'done' && (
          <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
            <span className="text-xs text-primary font-medium">Delivered</span>
            <ChevronRight className="w-4 h-4 text-primary" />
          </div>
        )}

        {type === 'rejected' && (
          <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg">
            <span className="text-xs text-destructive font-medium">Rejected</span>
            <ChevronRight className="w-4 h-4 text-destructive" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const Empty = ({ text }: { text: string }) => (
    <div className="text-center py-12">
      <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-14 w-full mb-4 rounded-xl" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full mb-4" />
        {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full mb-3 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
            onClick={() => navigate('/delivery/profile')}
          >
            <User className="h-5 w-5 text-primary" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Truck className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base">Delivery</h1>
              <p className="text-[10px] text-muted-foreground">{deliveryTimeMinutes} min limit</p>
            </div>
          </div>
          <div className="w-10" /> {/* Spacer for symmetry */}
        </div>
      </header>
      {/* Stats Row - 4 Compact Cards */}
      <div className="grid grid-cols-4 gap-2 p-3">
        <Card className="border-0 bg-primary/10">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold">{stats.pending}</p>
            <p className="text-[9px] text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-primary/10">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-primary">₹{stats.earnings}</p>
            <p className="text-[9px] text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-primary/10">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold">{stats.today}</p>
            <p className="text-[9px] text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-secondary">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold">{stats.delivered}</p>
            <p className="text-[9px] text-muted-foreground">Orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Filter Dropdown */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Earnings period:</span>
        <select
          value={earningsFilter}
          onChange={(e) => setEarningsFilter(e.target.value as any)}
          className="text-xs rounded-md border border-border bg-background px-2 py-1"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{stats.earningsCount} × ₹5</span>
      </div>

      {/* Tabs */}
      <div className="px-3 pb-6">
        <Tabs defaultValue="new">
          <TabsList className="w-full grid grid-cols-4 h-9 mb-3 bg-muted">
            <TabsTrigger value="new" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              New{newOrders.length > 0 && ` (${newOrders.length})`}
            </TabsTrigger>
            <TabsTrigger value="transit" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Transit{inTransit.length > 0 && ` (${inTransit.length})`}
            </TabsTrigger>
            <TabsTrigger value="await" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Await{awaiting.length > 0 && ` (${awaiting.length})`}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-[10px] data-[state=active]:bg-destructive data-[state=active]:text-white">Reject</TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            {newOrders.length === 0 ? <Empty text="No new orders" /> : newOrders.map(a => <OrderCard key={a.id} a={a} type="new" />)}
          </TabsContent>
          <TabsContent value="transit">
            {inTransit.length === 0 ? <Empty text="No orders in transit" /> : inTransit.map(a => <OrderCard key={a.id} a={a} type="transit" />)}
          </TabsContent>
          <TabsContent value="await">
            {awaiting.length === 0 ? <Empty text="No pending confirmations" /> : awaiting.map(a => <OrderCard key={a.id} a={a} type="await" />)}
          </TabsContent>
          <TabsContent value="rejected">
            {rejected.length === 0 ? <Empty text="No rejected orders" /> : rejected.map(a => <OrderCard key={a.id} a={a} type="rejected" />)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
