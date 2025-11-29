import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface Order {
  id: string;
  total_amount: number;
  delivery_address: string;
  status: string;
  created_at: string;
  delivery_assignments: Array<{
    id: string;
    marked_delivered_at: string | null;
    user_confirmed_at: string | null;
    is_rejected: boolean;
  }>;
}

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    orderId: string | null;
    assignmentId: string | null;
  }>({
    open: false,
    orderId: null,
    assignmentId: null
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchOrders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_assignments'
        },
        (payload) => {
          // Auto-show confirmation dialog when delivery is marked
          if (payload.new.marked_delivered_at && !payload.new.user_confirmed_at && !payload.old.marked_delivered_at) {
            fetchOrders();
            // Find the order and show dialog
            setTimeout(() => {
              const assignment = payload.new;
              setConfirmDialog({
                open: true,
                orderId: assignment.order_id,
                assignmentId: assignment.id
              });
              toast.info('Delivery person marked your order as delivered!', {
                duration: 5000,
              });
            }, 500);
          } else {
            fetchOrders();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, navigate]);

  const fetchOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select('*, delivery_assignments(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedOrders = data.map(order => ({
        ...order,
        delivery_assignments: Array.isArray(order.delivery_assignments) 
          ? order.delivery_assignments 
          : order.delivery_assignments ? [order.delivery_assignments] : []
      }));
      setOrders(formattedOrders as Order[]);
    }
    setLoading(false);
  };

  const confirmDelivery = async () => {
    if (!confirmDialog.assignmentId) return;

    const { error } = await supabase
      .from('delivery_assignments')
      .update({ user_confirmed_at: new Date().toISOString() })
      .eq('id', confirmDialog.assignmentId);

    if (!error) {
      await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', confirmDialog.orderId);

      toast.success('Order confirmed as delivered!');
      fetchOrders();
    } else {
      toast.error('Failed to confirm delivery');
    }

    setConfirmDialog({ open: false, orderId: null, assignmentId: null });
  };

  const rejectDelivery = async () => {
    if (!confirmDialog.assignmentId) return;

    // First get assignment details before updating
    const { data: assignment } = await supabase
      .from('delivery_assignments')
      .select('delivery_person_id, order_id')
      .eq('id', confirmDialog.assignmentId)
      .single();

    const { error: assignmentError } = await supabase
      .from('delivery_assignments')
      .update({ 
        is_rejected: true,
        rejection_reason: 'User rejected delivery',
        marked_delivered_at: null // Reset to allow retry
      })
      .eq('id', confirmDialog.assignmentId);

    if (!assignmentError) {
      await supabase
        .from('orders')
        .update({ status: 'pending' }) // Reset to pending for retry
        .eq('id', confirmDialog.orderId);

      // Log malicious activity
      if (assignment) {
        await supabase
          .from('malicious_activities')
          .insert({
            order_id: assignment.order_id,
            user_id: user?.id,
            delivery_person_id: assignment.delivery_person_id,
            activity_type: 'delivery_rejected',
            description: 'User rejected the delivery after delivery person marked as delivered. This could indicate fraudulent delivery attempt or genuine delivery failure.'
          });
      }

      toast.success('Issue reported. Admin has been notified and delivery will be reattempted.');
      fetchOrders();
    } else {
      toast.error('Failed to report issue');
    }

    setConfirmDialog({ open: false, orderId: null, assignmentId: null });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'confirmed':
        return <Package className="h-4 w-4" />;
      case 'out_for_delivery':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/10 text-warning';
      case 'confirmed':
        return 'bg-info/10 text-info';
      case 'out_for_delivery':
        return 'bg-primary/10 text-primary';
      case 'delivered':
        return 'bg-success/10 text-success';
      case 'cancelled':
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted/10 text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shop')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Orders</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Package className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
              <Button onClick={() => navigate('/shop')} className="mt-4">
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const assignment = order.delivery_assignments[0];
              const needsConfirmation = assignment?.marked_delivered_at && !assignment.user_confirmed_at && !assignment.is_rejected;

              return (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(order.status)}
                          <span className="capitalize">{order.status.replace('_', ' ')}</span>
                        </div>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-medium">${order.total_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery Address:</span>
                        <span className="font-medium text-right max-w-[200px]">{order.delivery_address}</span>
                      </div>
                      {needsConfirmation && (
                        <div className="mt-4 p-4 bg-warning/10 rounded-lg">
                          <p className="text-sm font-medium mb-3">Delivery person marked this as delivered. Did you receive your order?</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => setConfirmDialog({
                                open: true,
                                orderId: order.id,
                                assignmentId: assignment.id
                              })}
                            >
                              Yes, Received
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  orderId: order.id,
                                  assignmentId: assignment.id
                                });
                              }}
                            >
                              No, Report Issue
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>
              Please confirm whether you received your order or report an issue.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button onClick={confirmDelivery} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              Received
            </Button>
            <Button onClick={rejectDelivery} variant="destructive" className="flex-1">
              <XCircle className="mr-2 h-4 w-4" />
              Report Issue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
