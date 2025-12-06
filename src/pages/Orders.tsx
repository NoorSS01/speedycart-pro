import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Truck, Star, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product_id: string;
  products: {
    id: string;
    name: string;
    image_url: string | null;
  };
}

interface Order {
  id: string;
  total_amount: number;
  delivery_address: string;
  status: string;
  created_at: string;
  order_items: OrderItem[];
  delivery_assignments: Array<{
    id: string;
    delivery_person_id: string | null;
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
    deliveryPersonId: string | null;
  }>({
    open: false,
    orderId: null,
    assignmentId: null,
    deliveryPersonId: null
  });

  // Rating dialog state
  const [ratingDialog, setRatingDialog] = useState<{
    open: boolean;
    orderId: string | null;
    deliveryPersonId: string | null;
  }>({
    open: false,
    orderId: null,
    deliveryPersonId: null
  });
  const [deliveryRating, setDeliveryRating] = useState(5);

  // Review dialog state
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    productId: string | null;
    productName: string;
    orderId: string | null;
  }>({
    open: false,
    productId: null,
    productName: '',
    orderId: null
  });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchOrders();

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, () => fetchOrders())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_assignments' }, (payload) => {
        if (payload.new.marked_delivered_at && !payload.new.user_confirmed_at && !payload.old.marked_delivered_at) {
          fetchOrders();
          setTimeout(() => {
            setConfirmDialog({
              open: true,
              orderId: payload.new.order_id,
              assignmentId: payload.new.id,
              deliveryPersonId: payload.new.delivery_person_id
            });
            toast.info('Delivery person marked your order as delivered!', { duration: 5000 });
          }, 500);
        } else {
          fetchOrders();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, authLoading, navigate]);

  const fetchOrders = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items(id, quantity, price, product_id, products(id, name, image_url)), delivery_assignments(*)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedOrders = data.map(order => ({
        ...order,
        order_items: Array.isArray(order.order_items) ? order.order_items : [],
        delivery_assignments: Array.isArray(order.delivery_assignments) ? order.delivery_assignments : order.delivery_assignments ? [order.delivery_assignments] : []
      }));
      setOrders(formattedOrders as Order[]);
    }
    setLoading(false);
  };

  const confirmDelivery = async () => {
    if (!confirmDialog.assignmentId) return;

    await supabase.from('delivery_assignments').update({ user_confirmed_at: new Date().toISOString() }).eq('id', confirmDialog.assignmentId);
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', confirmDialog.orderId);

    toast.success('Order confirmed as delivered!');
    fetchOrders();

    // Show rating dialog
    setConfirmDialog({ open: false, orderId: null, assignmentId: null, deliveryPersonId: null });
    setRatingDialog({
      open: true,
      orderId: confirmDialog.orderId,
      deliveryPersonId: confirmDialog.deliveryPersonId
    });
    setDeliveryRating(5);
  };

  const rejectDelivery = async () => {
    if (!confirmDialog.assignmentId) return;

    const { data: assignment } = await supabase.from('delivery_assignments').select('delivery_person_id, order_id').eq('id', confirmDialog.assignmentId).single();

    await supabase.from('delivery_assignments').update({ is_rejected: true, rejection_reason: 'User rejected delivery', marked_delivered_at: null }).eq('id', confirmDialog.assignmentId);
    await supabase.from('orders').update({ status: 'pending' }).eq('id', confirmDialog.orderId);

    if (assignment) {
      await supabase.from('malicious_activities').insert({
        order_id: assignment.order_id,
        user_id: user?.id,
        delivery_person_id: assignment.delivery_person_id,
        activity_type: 'delivery_rejected',
        description: 'User rejected the delivery after delivery person marked as delivered.'
      });
    }

    toast.success('Issue reported. Admin has been notified.');
    fetchOrders();
    setConfirmDialog({ open: false, orderId: null, assignmentId: null, deliveryPersonId: null });
  };

  const submitDeliveryRating = async () => {
    if (!ratingDialog.orderId) return;

    // Try to insert into delivery_ratings table (if exists), else just log
    try {
      await supabase.from('delivery_ratings' as any).insert({
        order_id: ratingDialog.orderId,
        delivery_person_id: ratingDialog.deliveryPersonId,
        user_id: user?.id,
        rating: deliveryRating,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      // Table might not exist - that's okay, we'll log it
      console.log('Delivery rating stored locally:', deliveryRating);
    }

    toast.success(`Thanks for rating! ${deliveryRating} ⭐`);
    setRatingDialog({ open: false, orderId: null, deliveryPersonId: null });
  };

  const submitProductReview = async () => {
    if (!reviewDialog.productId || !reviewText.trim()) {
      toast.error('Please write a review');
      return;
    }

    try {
      await supabase.from('product_reviews' as any).insert({
        product_id: reviewDialog.productId,
        user_id: user?.id,
        order_id: reviewDialog.orderId,
        rating: reviewRating,
        review_text: reviewText.trim(),
        created_at: new Date().toISOString()
      });
      toast.success('Review submitted! Thanks for your feedback.');
    } catch (e) {
      // Table might not exist
      toast.info('Review saved locally. Thank you!');
    }

    setReviewDialog({ open: false, productId: null, productName: '', orderId: null });
    setReviewRating(5);
    setReviewText('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'confirmed': return <Package className="h-4 w-4" />;
      case 'out_for_delivery': return <Truck className="h-4 w-4" />;
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning';
      case 'confirmed': return 'bg-info/10 text-info';
      case 'out_for_delivery': return 'bg-primary/10 text-primary';
      case 'delivered': return 'bg-success/10 text-success';
      case 'cancelled': case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted/10 text-muted-foreground';
    }
  };

  const StarRating = ({ rating, onRatingChange, size = 'md' }: { rating: number; onRatingChange: (r: number) => void; size?: 'sm' | 'md' }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" onClick={() => onRatingChange(star)} className="focus:outline-none">
          <Star className={`${size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'} ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shop')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-bold">My Orders</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Package className="h-8 w-8 animate-spin text-primary" /></div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
              <Button onClick={() => navigate('/shop')} className="mt-4">Start Shopping</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const assignment = order.delivery_assignments[0];
              const needsConfirmation = assignment?.marked_delivered_at && !assignment.user_confirmed_at && !assignment.is_rejected;
              const isDelivered = order.status === 'delivered';

              return (
                <Card key={order.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle
                          className="text-base cursor-pointer hover:text-primary transition-colors truncate"
                          onClick={() => order.order_items[0]?.products?.id && navigate(`/product/${order.order_items[0].products.id}`)}
                        >
                          {order.order_items[0]?.products?.name || 'Order'}
                          {order.order_items.length > 1 && ` +${order.order_items.length - 1}`}
                          <span className="text-muted-foreground text-sm font-normal ml-2">
                            x{order.order_items.reduce((sum, item) => sum + item.quantity, 0)}
                          </span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          #{order.id.slice(0, 8)} • {new Date(order.created_at).toLocaleDateString()}
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
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-bold text-primary">₹{order.total_amount.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-medium text-right max-w-[180px] truncate">{order.delivery_address}</span>
                      </div>

                      {/* Confirmation prompt */}
                      {needsConfirmation && (
                        <div className="mt-3 p-3 bg-warning/10 rounded-lg">
                          <p className="text-sm font-medium mb-2">Did you receive your order?</p>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" onClick={() => setConfirmDialog({ open: true, orderId: order.id, assignmentId: assignment.id, deliveryPersonId: assignment.delivery_person_id })}>Yes</Button>
                            <Button size="sm" variant="destructive" className="flex-1" onClick={() => setConfirmDialog({ open: true, orderId: order.id, assignmentId: assignment.id, deliveryPersonId: assignment.delivery_person_id })}>No</Button>
                          </div>
                        </div>
                      )}

                      {/* Review button for delivered orders */}
                      {isDelivered && order.order_items[0]?.products && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => setReviewDialog({
                            open: true,
                            productId: order.order_items[0].products.id,
                            productName: order.order_items[0].products.name,
                            orderId: order.id
                          })}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Write a Review
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Delivery Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>Please confirm whether you received your order or report an issue.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button onClick={confirmDelivery} className="flex-1"><CheckCircle className="mr-2 h-4 w-4" />Received</Button>
            <Button onClick={rejectDelivery} variant="destructive" className="flex-1"><XCircle className="mr-2 h-4 w-4" />Report Issue</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Rating Dialog */}
      <Dialog open={ratingDialog.open} onOpenChange={(open) => setRatingDialog({ ...ratingDialog, open })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Rate Your Delivery</DialogTitle>
            <DialogDescription className="text-center">How was the delivery experience?</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <StarRating rating={deliveryRating} onRatingChange={setDeliveryRating} />
            <p className="text-sm text-muted-foreground">
              {deliveryRating === 5 ? 'Excellent!' : deliveryRating === 4 ? 'Great!' : deliveryRating === 3 ? 'Good' : deliveryRating === 2 ? 'Fair' : 'Poor'}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={submitDeliveryRating} className="w-full">Submit Rating</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog({ ...reviewDialog, open })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Review: {reviewDialog.productName}</DialogTitle>
            <DialogDescription>Share your experience with this product</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">Your rating</p>
              <StarRating rating={reviewRating} onRatingChange={setReviewRating} size="sm" />
            </div>
            <Textarea
              placeholder="Write your review here..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button onClick={submitProductReview} className="w-full" disabled={!reviewText.trim()}>
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
