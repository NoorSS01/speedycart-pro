import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface DeliveryOrder {
  id: string;
  order_id: string;
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

    // Subscribe to realtime updates
    const channel = supabase
      .channel('delivery-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_assignments',
          filter: `delivery_person_id=eq.${user.id}`
        },
        () => {
          fetchAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userRole, authLoading, navigate]);

  const fetchAssignments = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('delivery_assignments')
      .select(`
        *,
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

    if (!error && data) {
      // Fetch user profiles and order items separately
      const ordersWithDetails = await Promise.all(
        data.map(async (assignment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone, full_name')
            .eq('id', assignment.orders.user_id)
            .single();

          const { data: orderItems } = await supabase
            .from('order_items')
            .select(`
              id,
              quantity,
              price,
              products (
                name,
                image_url
              )
            `)
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
    }
    setLoading(false);
  };

  const markAsDelivered = async (assignmentId: string, orderId: string) => {
    const { error: assignmentError } = await supabase
      .from('delivery_assignments')
      .update({
        marked_delivered_at: new Date().toISOString(),
        is_rejected: false // Reset rejection status
      })
      .eq('id', assignmentId);

    if (!assignmentError) {
      await supabase
        .from('orders')
        .update({ status: 'out_for_delivery' })
        .eq('id', orderId);

      toast.success('Marked as delivered. Customer will be notified for confirmation.');
      fetchAssignments();
    } else {
      toast.error('Failed to mark as delivered');
    }
  };

  const pendingOrders = assignments.filter(
    a => (!a.marked_delivered_at && !a.is_rejected) || a.is_rejected
  );

  const awaitingConfirmation = assignments.filter(
    a => a.marked_delivered_at && !a.user_confirmed_at && !a.is_rejected
  );

  const completedOrders = assignments.filter(
    a => a.user_confirmed_at
  );

  const rejectedOrders = assignments.filter(
    a => a.is_rejected
  );

  const OrderCard = ({ assignment, showDeliveredButton = false }: { assignment: DeliveryOrder; showDeliveredButton?: boolean }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Order #{assignment.order_id.slice(0, 8)}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {assignment.orders.profiles.full_name || 'Customer'}
            </p>
            <p className="text-sm text-muted-foreground">
              {assignment.orders.profiles.phone}
            </p>
          </div>
          <Badge variant="outline">
            ${assignment.orders.total_amount.toFixed(2)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Product List */}
          <div>
            <p className="text-sm font-medium mb-2">Products:</p>
            <div className="space-y-2">
              {assignment.orders.order_items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                  {item.products.image_url && (
                    <img
                      src={item.products.image_url}
                      alt={item.products.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.products.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Delivery Address:</p>
            <p className="text-sm text-muted-foreground">{assignment.orders.delivery_address}</p>
          </div>

          {showDeliveredButton && (
            <Button
              onClick={() => markAsDelivered(assignment.id, assignment.order_id)}
              className="w-full"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Delivered
            </Button>
          )}

          {assignment.marked_delivered_at && !assignment.user_confirmed_at && !assignment.is_rejected && (
            <div className="p-3 bg-warning/10 rounded-lg">
              <p className="text-sm text-warning flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Awaiting customer confirmation
              </p>
            </div>
          )}

          {assignment.is_rejected && (
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                Delivery was rejected - Ready for retry
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background pb-8">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background pb-8">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Delivery Dashboard</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending">
              Pending
              {pendingOrders.length > 0 && (
                <Badge className="ml-2" variant="default">{pendingOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="awaiting">
              Awaiting
              {awaitingConfirmation.length > 0 && (
                <Badge className="ml-2" variant="secondary">{awaitingConfirmation.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected
              {rejectedOrders.length > 0 && (
                <Badge className="ml-2" variant="destructive">{rejectedOrders.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6 space-y-4">
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending deliveries</p>
                </CardContent>
              </Card>
            ) : (
              pendingOrders.map(assignment => (
                <OrderCard key={assignment.id} assignment={assignment} showDeliveredButton />
              ))
            )}
          </TabsContent>

          <TabsContent value="awaiting" className="mt-6 space-y-4">
            {awaitingConfirmation.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No orders awaiting confirmation</p>
                </CardContent>
              </Card>
            ) : (
              awaitingConfirmation.map(assignment => (
                <OrderCard key={assignment.id} assignment={assignment} />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6 space-y-4">
            {completedOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No completed deliveries yet</p>
                </CardContent>
              </Card>
            ) : (
              completedOrders.map(assignment => (
                <OrderCard key={assignment.id} assignment={assignment} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-6 space-y-4">
            {rejectedOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No rejected deliveries - Great job!</p>
                </CardContent>
              </Card>
            ) : (
              rejectedOrders.map(assignment => (
                <div key={assignment.id}>
                  <OrderCard assignment={assignment} />
                  <Card className="mt-2 border-destructive">
                    <CardContent className="p-4">
                      <p className="text-sm text-destructive flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        Delivery was rejected - This has been reported as suspicious activity
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Admin has been notified. You can attempt redelivery from the Pending tab.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
