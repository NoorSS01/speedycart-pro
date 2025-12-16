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
  Clock,
  PackageCheck,
  Navigation
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

    // Realtime subscription - listen to both tables
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
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select(`
          id, order_id, assigned_at, marked_delivered_at, user_confirmed_at, is_rejected,
          orders!inner (id, total_amount, delivery_address, status, created_at)
        `)
        .eq('delivery_person_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        setAssignments([]);
      } else {
        setAssignments((data || []).map((a: any) => ({
          ...a,
          is_rejected: a.is_rejected || false
        })));
      }
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
      toast.success('Order picked up!');
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
      toast.success('Marked as delivered!');
      fetchAssignments();
    } else {
      toast.error('Failed');
    }
    setActionLoading(null);
  };

  // Open Google Maps
  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  // Categorize orders
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
    const todayDone = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= today).length;
    return {
      today: todayDone,
      earnings: completed.length * 5,
      pending: newOrders.length + inTransit.length
    };
  }, [completed, newOrders, inTransit]);

  // Order Card - Platform Theme
  const OrderCard = ({ a, type }: { a: DeliveryOrder; type: 'new' | 'transit' | 'await' | 'done' }) => (
    <Card className="mb-3 border border-border/40">
      <CardContent className="p-4">
        {/* Order Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-bold text-foreground">#{a.order_id.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(a.orders.created_at), 'dd MMM, hh:mm a')}
            </p>
          </div>
          <Badge className="bg-primary text-primary-foreground">
            ₹{a.orders.total_amount}
          </Badge>
        </div>

        {/* Address with Map Button */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 flex items-start gap-2 p-3 bg-muted rounded-lg">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-tight">
              {a.orders.delivery_address}
            </p>
          </div>
          <Button
            size="icon"
            className="h-auto aspect-square bg-primary hover:bg-primary/90"
            onClick={() => openMaps(a.orders.delivery_address)}
          >
            <Navigation className="w-4 h-4" />
          </Button>
        </div>

        {/* Action Buttons */}
        {type === 'new' && (
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => pickOrder(a.id, a.order_id)}
            disabled={actionLoading === a.id}
          >
            <Truck className="w-4 h-4 mr-2" />
            {actionLoading === a.id ? 'Picking...' : 'Pick Up Order'}
          </Button>
        )}

        {type === 'transit' && (
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => markAsDelivered(a.id)}
            disabled={actionLoading === a.id}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {actionLoading === a.id ? 'Marking...' : 'Mark Delivered'}
          </Button>
        )}

        {type === 'await' && (
          <div className="flex items-center justify-center gap-2 p-3 bg-secondary rounded-lg">
            <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
            <p className="text-sm text-secondary-foreground font-medium">
              Awaiting customer confirmation
            </p>
          </div>
        )}

        {type === 'done' && (
          <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
            <PackageCheck className="w-4 h-4 text-primary" />
            <p className="text-sm text-primary font-medium">
              Delivered Successfully
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Empty State
  const Empty = ({ text }: { text: string }) => (
    <div className="text-center py-16">
      <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-16 w-full mb-4 rounded-xl" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full mb-4 rounded-lg" />
        {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full mb-3 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header - Platform Style */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/40 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">Delivery</h1>
              <p className="text-xs text-muted-foreground">Partner Dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Stats - Platform Colors */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-3 text-center">
            <PackageCheck className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold text-foreground">{stats.today}</p>
            <p className="text-[10px] text-muted-foreground">Today</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-3 text-center">
            <span className="text-primary font-bold text-lg">₹</span>
            <p className="text-xl font-bold text-foreground">{stats.earnings}</p>
            <p className="text-[10px] text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
        <Card className="bg-secondary border-border">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs - Platform Style */}
      <div className="px-4 pb-8">
        <Tabs defaultValue="new">
          <TabsList className="w-full grid grid-cols-4 h-10 mb-4 bg-muted">
            <TabsTrigger value="new" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              New {newOrders.length > 0 && <Badge className="ml-1 h-4 px-1 bg-primary/80 text-[10px]">{newOrders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="transit" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Transit {inTransit.length > 0 && <Badge className="ml-1 h-4 px-1 bg-primary/80 text-[10px]">{inTransit.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="await" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Await {awaiting.length > 0 && <Badge className="ml-1 h-4 px-1 bg-primary/80 text-[10px]">{awaiting.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="done" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Done
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            {newOrders.length === 0 ? <Empty text="No new orders" /> :
              newOrders.map(a => <OrderCard key={a.id} a={a} type="new" />)}
          </TabsContent>

          <TabsContent value="transit">
            {inTransit.length === 0 ? <Empty text="No orders in transit" /> :
              inTransit.map(a => <OrderCard key={a.id} a={a} type="transit" />)}
          </TabsContent>

          <TabsContent value="await">
            {awaiting.length === 0 ? <Empty text="No pending confirmations" /> :
              awaiting.map(a => <OrderCard key={a.id} a={a} type="await" />)}
          </TabsContent>

          <TabsContent value="done">
            {completed.length === 0 ? <Empty text="No completed deliveries" /> :
              completed.slice(0, 15).map(a => <OrderCard key={a.id} a={a} type="done" />)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
