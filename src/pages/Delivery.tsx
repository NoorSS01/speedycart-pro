import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  Phone, 
  User,
  IndianRupee,
  Clock,
  PackageCheck
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
    customer_name: string;
    customer_phone: string;
    items_count: number;
  };
}

export default function Delivery() {
  const { user, userRole, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

    // Realtime subscription
    const channel = supabase
      .channel('delivery-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delivery_assignments',
        filter: `delivery_person_id=eq.${user.id}`
      }, () => fetchAssignments())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders'
      }, () => fetchAssignments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userRole, authLoading, navigate]);

  // Optimized single-query fetch
  const fetchAssignments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Single query - fetch assignments with orders
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select(`
          id,
          order_id,
          assigned_at,
          marked_delivered_at,
          user_confirmed_at,
          is_rejected,
          orders!inner (
            id,
            total_amount,
            delivery_address,
            status,
            created_at,
            user_id
          )
        `)
        .eq('delivery_person_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Error:', error);
        setAssignments([]);
        return;
      }

      if (!data || data.length === 0) {
        setAssignments([]);
        return;
      }

      // Transform data - use placeholders for customer info
      const transformed = data.map((item: any) => ({
        id: item.id,
        order_id: item.order_id,
        assigned_at: item.assigned_at,
        marked_delivered_at: item.marked_delivered_at,
        user_confirmed_at: item.user_confirmed_at,
        is_rejected: item.is_rejected || false,
        orders: {
          id: item.orders.id,
          total_amount: item.orders.total_amount,
          delivery_address: item.orders.delivery_address,
          status: item.orders.status,
          created_at: item.orders.created_at,
          customer_name: 'Customer',
          customer_phone: '',
          items_count: 0
        }
      }));

      setAssignments(transformed);
    } catch (err) {
      console.error('Exception:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  // Pick order
  const pickOrder = async (assignmentId: string, orderId: string) => {
    setActionLoading(assignmentId);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'out_for_delivery' })
      .eq('id', orderId);

    if (!error) {
      toast.success('Order picked!');
      fetchAssignments();
    } else {
      toast.error('Failed');
    }
    setActionLoading(null);
  };

  // Mark delivered
  const markAsDelivered = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    const { error } = await supabase
      .from('delivery_assignments')
      .update({ marked_delivered_at: new Date().toISOString(), is_rejected: false })
      .eq('id', assignmentId);

    if (!error) {
      toast.success('Delivered! Waiting for confirmation.');
      fetchAssignments();
    } else {
      toast.error('Failed');
    }
    setActionLoading(null);
  };

  // Categories
  const newOrders = assignments.filter(
    a => !a.is_rejected && !a.marked_delivered_at && 
         (a.orders.status === 'pending' || a.orders.status === 'confirmed')
  );

  const inTransit = assignments.filter(
    a => !a.is_rejected && !a.marked_delivered_at && a.orders.status === 'out_for_delivery'
  );

  const awaiting = assignments.filter(
    a => !a.is_rejected && a.marked_delivered_at && !a.user_confirmed_at
  );

  const completed = assignments.filter(a => a.user_confirmed_at);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDone = completed.filter(a => new Date(a.user_confirmed_at!) >= today).length;
    return {
      today: todayDone,
      earnings: completed.length * 5,
      pending: newOrders.length + inTransit.length
    };
  }, [completed, newOrders, inTransit]);

  // Order Card - Mobile First
  const OrderCard = ({ a, type }: { a: DeliveryOrder; type: 'new' | 'transit' | 'await' | 'done' }) => (
    <Card className="mb-3">
      <CardContent className="p-3">
        {/* Top Row */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="font-bold text-sm">#{a.order_id.slice(0, 8)}</p>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(a.orders.created_at), 'dd MMM, hh:mm a')}
            </p>
          </div>
          <Badge className="bg-emerald-500 text-white text-xs">₹{a.orders.total_amount}</Badge>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 p-2 bg-muted/40 rounded-lg mb-3">
          <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs leading-tight">{a.orders.delivery_address}</p>
        </div>

        {/* Action */}
        {type === 'new' && (
          <Button 
            size="sm"
            className="w-full h-9 bg-blue-500 hover:bg-blue-600 text-sm"
            onClick={() => pickOrder(a.id, a.order_id)}
            disabled={actionLoading === a.id}
          >
            <Truck className="w-4 h-4 mr-1" />
            {actionLoading === a.id ? 'Picking...' : 'Pick Order'}
          </Button>
        )}

        {type === 'transit' && (
          <Button 
            size="sm"
            className="w-full h-9 bg-emerald-500 hover:bg-emerald-600 text-sm"
            onClick={() => markAsDelivered(a.id)}
            disabled={actionLoading === a.id}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {actionLoading === a.id ? 'Marking...' : 'Mark Delivered'}
          </Button>
        )}

        {type === 'await' && (
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Awaiting confirmation
            </p>
          </div>
        )}

        {type === 'done' && (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded text-center">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <PackageCheck className="w-3 h-3" /> Delivered
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Empty State
  const Empty = ({ text }: { text: string }) => (
    <div className="text-center py-12 text-muted-foreground">
      <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 pt-16">
        <Skeleton className="h-20 w-full mb-4 rounded-xl" />
        <Skeleton className="h-10 w-full mb-4 rounded-lg" />
        {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full mb-3 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header - Mobile */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">Delivery</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Stats - Mobile */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{stats.today}</p>
          <p className="text-[10px] text-muted-foreground">Today</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-600">₹{stats.earnings}</p>
          <p className="text-[10px] text-muted-foreground">Earned</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
          <p className="text-[10px] text-muted-foreground">Pending</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <Tabs defaultValue="new">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="new" className="text-xs">
              New {newOrders.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px] bg-blue-500">{newOrders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="transit" className="text-xs">
              Transit {inTransit.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px] bg-purple-500">{inTransit.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="await" className="text-xs">
              Await {awaiting.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px] bg-amber-500">{awaiting.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="done" className="text-xs">Done</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-3">
            {newOrders.length === 0 ? <Empty text="No new orders" /> : newOrders.map(a => <OrderCard key={a.id} a={a} type="new" />)}
          </TabsContent>

          <TabsContent value="transit" className="mt-3">
            {inTransit.length === 0 ? <Empty text="No orders in transit" /> : inTransit.map(a => <OrderCard key={a.id} a={a} type="transit" />)}
          </TabsContent>

          <TabsContent value="await" className="mt-3">
            {awaiting.length === 0 ? <Empty text="No pending confirmations" /> : awaiting.map(a => <OrderCard key={a.id} a={a} type="await" />)}
          </TabsContent>

          <TabsContent value="done" className="mt-3">
            {completed.length === 0 ? <Empty text="No completed deliveries" /> : completed.slice(0, 10).map(a => <OrderCard key={a.id} a={a} type="done" />)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
