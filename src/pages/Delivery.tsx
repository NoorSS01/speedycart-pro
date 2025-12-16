import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LogOut,
  Package,
  CheckCircle,
  AlertCircle,
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
    user_id: string;
    profiles: {
      phone: string;
      full_name: string | null;
    };
    order_items: Array<{
      id: string;
      quantity: number;
      price: number;
      products: {
        name: string;
        image_url: string | null;
      };
    }>;
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userRole, authLoading, navigate]);

  const fetchAssignments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select(`*, orders!inner (id, total_amount, delivery_address, status, created_at, user_id)`)
        .eq('delivery_person_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Error fetching assignments:', error);
        setAssignments([]);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Fetch profiles and items
      const ordersWithDetails = await Promise.all(
        data.map(async (assignment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone, full_name')
            .eq('id', assignment.orders.user_id)
            .single();

          const { data: orderItems } = await supabase
            .from('order_items')
            .select(`id, quantity, price, products (name, image_url)`)
            .eq('order_id', assignment.orders.id);

          return {
            ...assignment,
            orders: {
              ...assignment.orders,
              profiles: profile || { phone: '', full_name: null },
              order_items: orderItems || []
            }
          };
        })
      );
      setAssignments(ordersWithDetails as DeliveryOrder[]);
    } catch (err) {
      console.error('Exception in fetchAssignments:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  // Pick up order from store
  const pickOrder = async (assignmentId: string, orderId: string) => {
    setActionLoading(assignmentId);

    const { error } = await supabase
      .from('orders')
      .update({ status: 'out_for_delivery' })
      .eq('id', orderId);

    if (!error) {
      toast.success('Order picked! Now deliver to customer.');
      fetchAssignments();
    } else {
      toast.error('Failed to pick order');
    }
    setActionLoading(null);
  };

  // Mark as delivered (awaiting customer confirmation)
  const markAsDelivered = async (assignmentId: string, orderId: string) => {
    setActionLoading(assignmentId);

    const { error } = await supabase
      .from('delivery_assignments')
      .update({
        marked_delivered_at: new Date().toISOString(),
        is_rejected: false
      })
      .eq('id', assignmentId);

    if (!error) {
      toast.success('Marked as delivered! Waiting for customer confirmation.');
      fetchAssignments();
    } else {
      toast.error('Failed to mark as delivered');
    }
    setActionLoading(null);
  };

  // Categorize orders
  const newOrders = assignments.filter(
    a => !a.is_rejected && !a.marked_delivered_at &&
      (a.orders.status === 'pending' || a.orders.status === 'confirmed')
  );

  const inTransitOrders = assignments.filter(
    a => !a.is_rejected && !a.marked_delivered_at &&
      a.orders.status === 'out_for_delivery'
  );

  const awaitingOrders = assignments.filter(
    a => !a.is_rejected && a.marked_delivered_at && !a.user_confirmed_at
  );

  const completedOrders = assignments.filter(a => a.user_confirmed_at);

  // Stats
  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCompleted = completedOrders.filter(
      a => new Date(a.user_confirmed_at!) >= todayStart
    ).length;

    return {
      todayDeliveries: todayCompleted,
      totalEarnings: completedOrders.length * 5, // ₹5 per delivery
      pending: newOrders.length + inTransitOrders.length
    };
  }, [completedOrders, newOrders, inTransitOrders]);

  // Order Card Component
  const OrderCard = ({ assignment, type }: {
    assignment: DeliveryOrder;
    type: 'new' | 'transit' | 'awaiting' | 'completed'
  }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-sm">#{assignment.order_id.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(assignment.orders.created_at), 'dd MMM, hh:mm a')}
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary">
            ₹{assignment.orders.total_amount}
          </Badge>
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {assignment.orders.profiles.full_name || 'Customer'}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {assignment.orders.profiles.phone || 'No phone'}
            </p>
          </div>
        </div>

        {/* Products */}
        <div className="space-y-2 mb-3">
          {assignment.orders.order_items.slice(0, 2).map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              {item.products.image_url ? (
                <img
                  src={item.products.image_url}
                  alt={item.products.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.products.name}</p>
                <p className="text-xs text-muted-foreground">x{item.quantity}</p>
              </div>
            </div>
          ))}
          {assignment.orders.order_items.length > 2 && (
            <p className="text-xs text-muted-foreground">
              +{assignment.orders.order_items.length - 2} more items
            </p>
          )}
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg mb-3">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{assignment.orders.delivery_address}</p>
        </div>

        {/* Action Buttons */}
        {type === 'new' && (
          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            onClick={() => pickOrder(assignment.id, assignment.order_id)}
            disabled={actionLoading === assignment.id}
          >
            <Truck className="w-4 h-4 mr-2" />
            {actionLoading === assignment.id ? 'Picking...' : 'Pick Order'}
          </Button>
        )}

        {type === 'transit' && (
          <Button
            className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
            onClick={() => markAsDelivered(assignment.id, assignment.order_id)}
            disabled={actionLoading === assignment.id}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {actionLoading === assignment.id ? 'Marking...' : 'Mark Delivered'}
          </Button>
        )}

        {type === 'awaiting' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Awaiting customer confirmation
            </p>
          </div>
        )}

        {type === 'completed' && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <PackageCheck className="w-4 h-4" />
              Delivered successfully
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Empty State
  const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
    <Card>
      <CardContent className="py-12 text-center">
        <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-8">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Delivery</h1>
                <p className="text-xs text-muted-foreground">Partner Dashboard</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 border-emerald-100">
            <CardContent className="p-3 text-center">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg w-fit mx-auto mb-1">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-bold">{stats.todayDeliveries}</p>
              <p className="text-[10px] text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 border-blue-100">
            <CardContent className="p-3 text-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg w-fit mx-auto mb-1">
                <IndianRupee className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xl font-bold">₹{stats.totalEarnings}</p>
              <p className="text-[10px] text-muted-foreground">Earnings</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 border-amber-100">
            <CardContent className="p-3 text-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg w-fit mx-auto mb-1">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xl font-bold">{stats.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="new" className="text-xs py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              New
              {newOrders.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-blue-600">{newOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="transit" className="text-xs py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              Transit
              {inTransitOrders.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-purple-600">{inTransitOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="awaiting" className="text-xs py-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              Await
              {awaitingOrders.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-amber-600">{awaitingOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs py-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              Done
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4 space-y-4">
            {newOrders.length === 0 ? (
              <EmptyState icon={Package} text="No new orders" />
            ) : (
              newOrders.map(a => <OrderCard key={a.id} assignment={a} type="new" />)
            )}
          </TabsContent>

          <TabsContent value="transit" className="mt-4 space-y-4">
            {inTransitOrders.length === 0 ? (
              <EmptyState icon={Truck} text="No orders in transit" />
            ) : (
              inTransitOrders.map(a => <OrderCard key={a.id} assignment={a} type="transit" />)
            )}
          </TabsContent>

          <TabsContent value="awaiting" className="mt-4 space-y-4">
            {awaitingOrders.length === 0 ? (
              <EmptyState icon={Clock} text="No orders awaiting confirmation" />
            ) : (
              awaitingOrders.map(a => <OrderCard key={a.id} assignment={a} type="awaiting" />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-4">
            {completedOrders.length === 0 ? (
              <EmptyState icon={CheckCircle} text="No completed deliveries yet" />
            ) : (
              completedOrders.slice(0, 10).map(a => <OrderCard key={a.id} assignment={a} type="completed" />)
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
