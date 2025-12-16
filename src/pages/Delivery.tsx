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
  IndianRupee,
  Clock,
  PackageCheck,
  Navigation,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  products: {
    name: string;
    image_url: string | null;
  };
}

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
  };
  customer: {
    name: string;
    phone: string;
  };
  items: OrderItem[];
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

    // Realtime - listen to BOTH tables
    const channel = supabase
      .channel('delivery-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delivery_assignments'
      }, () => {
        console.log('delivery_assignments changed');
        fetchAssignments();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        console.log('orders changed');
        fetchAssignments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userRole, authLoading, navigate]);

  const fetchAssignments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch assignments
      const { data: assignmentsData, error } = await supabase
        .from('delivery_assignments')
        .select(`
          id, order_id, assigned_at, marked_delivered_at, user_confirmed_at, is_rejected,
          orders!inner (id, total_amount, delivery_address, status, created_at, user_id)
        `)
        .eq('delivery_person_id', user.id)
        .order('assigned_at', { ascending: false });

      if (error || !assignmentsData) {
        console.error('Error:', error);
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Fetch customer profiles and order items in parallel
      const enrichedData = await Promise.all(
        assignmentsData.map(async (a: any) => {
          // Fetch customer profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', a.orders.user_id)
            .single();

          // Fetch order items
          const { data: items } = await supabase
            .from('order_items')
            .select('id, quantity, price, products(name, image_url)')
            .eq('order_id', a.orders.id);

          return {
            id: a.id,
            order_id: a.order_id,
            assigned_at: a.assigned_at,
            marked_delivered_at: a.marked_delivered_at,
            user_confirmed_at: a.user_confirmed_at,
            is_rejected: a.is_rejected || false,
            orders: a.orders,
            customer: {
              name: profile?.full_name || 'Customer',
              phone: profile?.phone || ''
            },
            items: items || []
          };
        })
      );

      setAssignments(enrichedData);
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
      toast.success('Order picked! Head to customer.');
      fetchAssignments();
    } else {
      toast.error('Failed to pick order');
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
      toast.success('Marked delivered! Waiting for customer.');
      fetchAssignments();
    } else {
      toast.error('Failed');
    }
    setActionLoading(null);
  };

  // Categorize
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

  // Call customer
  const callCustomer = (phone: string) => {
    if (phone) window.location.href = `tel:${phone}`;
  };

  // Open maps
  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  // Order Card - Professional Design
  const OrderCard = ({ a, type }: { a: DeliveryOrder; type: 'new' | 'transit' | 'await' | 'done' }) => {
    const totalItems = a.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <Card className="mb-3 overflow-hidden border-0 shadow-md">
        {/* Header with order ID and amount */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-3 flex justify-between items-center">
          <div>
            <p className="text-white font-bold text-sm">Order #{a.order_id.slice(0, 8)}</p>
            <p className="text-slate-300 text-[10px]">
              {format(new Date(a.orders.created_at), 'dd MMM, hh:mm a')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-emerald-400 font-bold text-lg">₹{a.orders.total_amount}</p>
            <p className="text-slate-400 text-[10px]">{totalItems} items</p>
          </div>
        </div>

        <CardContent className="p-3 space-y-3">
          {/* Customer Info Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">
                  {a.customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-sm">{a.customer.name}</p>
                <p className="text-muted-foreground text-xs">{a.customer.phone || 'No phone'}</p>
              </div>
            </div>
            {a.customer.phone && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 rounded-full border-emerald-200 bg-emerald-50"
                onClick={() => callCustomer(a.customer.phone)}
              >
                <Phone className="w-4 h-4 text-emerald-600" />
              </Button>
            )}
          </div>

          {/* Products List */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">Products</p>
            <div className="space-y-2">
              {a.items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  {item.products.image_url ? (
                    <img
                      src={item.products.image_url}
                      alt={item.products.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center">
                      <Package className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.products.name}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5">×{item.quantity}</Badge>
                </div>
              ))}
              {a.items.length > 3 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  +{a.items.length - 3} more items
                </p>
              )}
            </div>
          </div>

          {/* Address with Map Button */}
          <div className="flex items-start gap-2">
            <div className="flex-1 flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight">
                {a.orders.delivery_address}
              </p>
            </div>
            <Button
              size="sm"
              className="h-full px-3 bg-blue-500 hover:bg-blue-600"
              onClick={() => openMaps(a.orders.delivery_address)}
            >
              <Navigation className="w-4 h-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          {type === 'new' && (
            <Button
              className="w-full h-11 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium"
              onClick={() => pickOrder(a.id, a.order_id)}
              disabled={actionLoading === a.id}
            >
              <Truck className="w-5 h-5 mr-2" />
              {actionLoading === a.id ? 'Picking...' : 'Pick Up Order'}
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          )}

          {type === 'transit' && (
            <Button
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium"
              onClick={() => markAsDelivered(a.id)}
              disabled={actionLoading === a.id}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {actionLoading === a.id ? 'Marking...' : 'Mark as Delivered'}
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          )}

          {type === 'await' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                Waiting for customer confirmation
              </p>
            </div>
          )}

          {type === 'done' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                Delivered Successfully
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Empty State
  const Empty = ({ icon: Icon, text }: { icon: any; text: string }) => (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-muted-foreground">{text}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
        <Skeleton className="h-14 w-full mb-4 rounded-xl" />
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full mb-4 rounded-lg" />
        {[1, 2].map(i => <Skeleton key={i} className="h-56 w-full mb-3 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Delivery Partner</h1>
              <p className="text-xs text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg">
          <CardContent className="p-3 text-center text-white">
            <PackageCheck className="w-6 h-6 mx-auto mb-1 opacity-80" />
            <p className="text-2xl font-bold">{stats.today}</p>
            <p className="text-[10px] opacity-80">Today</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
          <CardContent className="p-3 text-center text-white">
            <IndianRupee className="w-6 h-6 mx-auto mb-1 opacity-80" />
            <p className="text-2xl font-bold">₹{stats.earnings}</p>
            <p className="text-[10px] opacity-80">Earned</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 border-0 shadow-lg">
          <CardContent className="p-3 text-center text-white">
            <Clock className="w-6 h-6 mx-auto mb-1 opacity-80" />
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-[10px] opacity-80">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-8">
        <Tabs defaultValue="new">
          <TabsList className="w-full grid grid-cols-4 h-11 mb-4">
            <TabsTrigger value="new" className="text-xs font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              New
              {newOrders.length > 0 && <Badge className="ml-1 h-5 px-1.5 bg-blue-600 text-[10px]">{newOrders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="transit" className="text-xs font-medium data-[state=active]:bg-purple-500 data-[state=active]:text-white">
              Transit
              {inTransit.length > 0 && <Badge className="ml-1 h-5 px-1.5 bg-purple-600 text-[10px]">{inTransit.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="await" className="text-xs font-medium data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              Await
              {awaiting.length > 0 && <Badge className="ml-1 h-5 px-1.5 bg-amber-600 text-[10px]">{awaiting.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="done" className="text-xs font-medium data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              Done
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            {newOrders.length === 0 ? <Empty icon={Package} text="No new orders" /> :
              newOrders.map(a => <OrderCard key={a.id} a={a} type="new" />)}
          </TabsContent>

          <TabsContent value="transit">
            {inTransit.length === 0 ? <Empty icon={Truck} text="No orders in transit" /> :
              inTransit.map(a => <OrderCard key={a.id} a={a} type="transit" />)}
          </TabsContent>

          <TabsContent value="await">
            {awaiting.length === 0 ? <Empty icon={Clock} text="No pending confirmations" /> :
              awaiting.map(a => <OrderCard key={a.id} a={a} type="await" />)}
          </TabsContent>

          <TabsContent value="done">
            {completed.length === 0 ? <Empty icon={CheckCircle} text="No completed deliveries" /> :
              completed.slice(0, 15).map(a => <OrderCard key={a.id} a={a} type="done" />)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
