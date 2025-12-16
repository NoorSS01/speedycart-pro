import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    Package,
    MapPin,
    Phone,
    User,
    Clock,
    Navigation,
    CheckCircle,
    Truck
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
        unit: string;
    };
}

interface OrderDetail {
    id: string;
    total_amount: number;
    delivery_address: string;
    status: string;
    created_at: string;
    user_id: string;
    order_items: OrderItem[];
    profiles: {
        full_name: string | null;
        phone: string | null;
    } | null;
    delivery_assignments: Array<{
        id: string;
        marked_delivered_at: string | null;
        user_confirmed_at: string | null;
    }>;
}

export default function DeliveryOrderDetail() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        if (orderId) fetchOrder();
    }, [user, authLoading, orderId, navigate]);

    const fetchOrder = async () => {
        if (!orderId) return;

        try {
            // Fetch order with items
            const { data: orderData, error } = await supabase
                .from('orders')
                .select(`
          id, total_amount, delivery_address, status, created_at, user_id,
          order_items(id, quantity, price, products(name, image_url, unit)),
          delivery_assignments(id, marked_delivered_at, user_confirmed_at)
        `)
                .eq('id', orderId)
                .single();

            if (error) {
                console.error('Error:', error);
                toast.error('Order not found');
                navigate('/delivery');
                return;
            }

            // Fetch customer profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', orderData.user_id)
                .single();

            setOrder({
                ...orderData,
                profiles: profile,
                order_items: Array.isArray(orderData.order_items) ? orderData.order_items : [],
                delivery_assignments: Array.isArray(orderData.delivery_assignments)
                    ? orderData.delivery_assignments
                    : orderData.delivery_assignments ? [orderData.delivery_assignments] : []
            } as OrderDetail);
        } catch (err) {
            console.error('Exception:', err);
            toast.error('Failed to load order');
            navigate('/delivery');
        } finally {
            setLoading(false);
        }
    };

    // Pick order
    const pickOrder = async () => {
        if (!order) return;
        setActionLoading(true);
        const { error } = await supabase
            .from('orders')
            .update({ status: 'out_for_delivery' })
            .eq('id', order.id);

        if (!error) {
            toast.success('Order picked up!');
            fetchOrder();
        } else {
            toast.error('Failed');
        }
        setActionLoading(false);
    };

    // Mark delivered
    const markAsDelivered = async () => {
        if (!order || !order.delivery_assignments[0]) return;
        setActionLoading(true);
        const { error } = await supabase
            .from('delivery_assignments')
            .update({ marked_delivered_at: new Date().toISOString() })
            .eq('id', order.delivery_assignments[0].id);

        if (!error) {
            toast.success('Marked as delivered!');
            fetchOrder();
        } else {
            toast.error('Failed');
        }
        setActionLoading(false);
    };

    // Open maps
    const openMaps = () => {
        if (!order) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`, '_blank');
    };

    // Call customer
    const callCustomer = () => {
        if (order?.profiles?.phone) {
            window.location.href = `tel:${order.profiles.phone}`;
        }
    };

    // Get status info
    const getStatusBadge = () => {
        if (!order) return null;
        const assignment = order.delivery_assignments[0];

        if (assignment?.user_confirmed_at) {
            return <Badge className="bg-emerald-500">Delivered</Badge>;
        }
        if (assignment?.marked_delivered_at) {
            return <Badge className="bg-amber-500">Awaiting Confirmation</Badge>;
        }
        if (order.status === 'out_for_delivery') {
            return <Badge className="bg-blue-500">In Transit</Badge>;
        }
        return <Badge className="bg-primary">Ready for Pickup</Badge>;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-4">
                <Skeleton className="h-10 w-32 mb-4" />
                <Skeleton className="h-40 w-full mb-4 rounded-xl" />
                <Skeleton className="h-24 w-full mb-4 rounded-xl" />
                <Skeleton className="h-60 w-full rounded-xl" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-muted-foreground">Order not found</p>
            </div>
        );
    }

    const assignment = order.delivery_assignments[0];
    const canPick = order.status === 'pending' || order.status === 'confirmed';
    const canDeliver = order.status === 'out_for_delivery' && !assignment?.marked_delivered_at;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/delivery')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="font-bold">Order Details</h1>
                        <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                    </div>
                    {getStatusBadge()}
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Customer Info */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Customer
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{order.profiles?.full_name || 'Customer'}</p>
                                <p className="text-sm text-muted-foreground">{order.profiles?.phone || 'No phone'}</p>
                            </div>
                            {order.profiles?.phone && (
                                <Button size="sm" variant="outline" className="gap-2" onClick={callCustomer}>
                                    <Phone className="w-4 h-4" />
                                    Call
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Delivery Address */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Delivery Address
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm mb-3">{order.delivery_address}</p>
                        <Button className="w-full" variant="outline" onClick={openMaps}>
                            <Navigation className="w-4 h-4 mr-2" />
                            Open in Google Maps
                        </Button>
                    </CardContent>
                </Card>

                {/* Order Items */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Items ({order.order_items.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {order.order_items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                                {item.products.image_url ? (
                                    <img
                                        src={item.products.image_url}
                                        alt={item.products.name}
                                        className="w-12 h-12 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                                        <Package className="w-6 h-6 text-slate-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{item.products.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.quantity} × ₹{item.price} = ₹{item.quantity * item.price}
                                    </p>
                                </div>
                                <Badge variant="secondary">×{item.quantity}</Badge>
                            </div>
                        ))}

                        {/* Total */}
                        <div className="flex justify-between items-center pt-3 border-t">
                            <span className="font-medium">Total</span>
                            <span className="text-xl font-bold text-primary">₹{order.total_amount}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Fixed Bottom Action */}
            {(canPick || canDeliver) && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
                    {canPick && (
                        <Button
                            className="w-full h-12 bg-primary hover:bg-primary/90"
                            onClick={pickOrder}
                            disabled={actionLoading}
                        >
                            <Truck className="w-5 h-5 mr-2" />
                            {actionLoading ? 'Picking...' : 'Pick Up Order'}
                        </Button>
                    )}
                    {canDeliver && (
                        <Button
                            className="w-full h-12 bg-primary hover:bg-primary/90"
                            onClick={markAsDelivered}
                            disabled={actionLoading}
                        >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            {actionLoading ? 'Marking...' : 'Mark as Delivered'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
