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
    product_id: string;
    product_name: string;
    product_image: string | null;
}

interface OrderData {
    id: string;
    total_amount: number;
    delivery_address: string;
    status: string;
    created_at: string;
    user_id: string;
}

export default function DeliveryOrderDetail() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<OrderData | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [customer, setCustomer] = useState<{ name: string; phone: string }>({ name: 'Customer', phone: '' });
    const [assignment, setAssignment] = useState<{ id: string; marked_delivered_at: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        if (orderId) fetchOrderData();
    }, [user, authLoading, orderId, navigate]);

    const fetchOrderData = async () => {
        if (!orderId) return;
        setLoading(true);

        try {
            // 1. Fetch order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('id, total_amount, delivery_address, status, created_at, user_id')
                .eq('id', orderId)
                .single();

            if (orderError || !orderData) {
                console.error('Order error:', orderError);
                toast.error('Order not found');
                navigate('/delivery');
                return;
            }
            setOrder(orderData);

            // 2. Fetch order items with products
            const { data: itemsData, error: itemsError } = await supabase
                .from('order_items')
                .select('id, quantity, price, product_id, products(name, image_url)')
                .eq('order_id', orderId);

            if (!itemsError && itemsData) {
                const formattedItems = itemsData.map((item: any) => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    product_id: item.product_id,
                    product_name: item.products?.name || 'Unknown Product',
                    product_image: item.products?.image_url || null
                }));
                setItems(formattedItems);
            }

            // 3. Fetch customer profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', orderData.user_id)
                .single();

            if (profileData) {
                setCustomer({
                    name: profileData.full_name || 'Customer',
                    phone: profileData.phone || ''
                });
            }

            // 4. Fetch delivery assignment
            const { data: assignmentData } = await supabase
                .from('delivery_assignments')
                .select('id, marked_delivered_at')
                .eq('order_id', orderId)
                .single();

            if (assignmentData) {
                setAssignment(assignmentData);
            }

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
            fetchOrderData();
        } else {
            toast.error('Failed');
        }
        setActionLoading(false);
    };

    // Mark delivered
    const markAsDelivered = async () => {
        if (!assignment) return;
        setActionLoading(true);
        const { error } = await supabase
            .from('delivery_assignments')
            .update({ marked_delivered_at: new Date().toISOString() })
            .eq('id', assignment.id);

        if (!error) {
            toast.success('Marked as delivered!');
            fetchOrderData();
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
        if (customer.phone) {
            window.location.href = `tel:${customer.phone}`;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-4">
                <Skeleton className="h-12 w-full mb-4" />
                <Skeleton className="h-24 w-full mb-4 rounded-xl" />
                <Skeleton className="h-24 w-full mb-4 rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
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
                    <Badge className="bg-primary">₹{order.total_amount}</Badge>
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
                                <p className="font-medium">{customer.name}</p>
                                <p className="text-sm text-muted-foreground">{customer.phone || 'No phone'}</p>
                            </div>
                            {customer.phone && (
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
                            Items ({items.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {items.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">No items found</p>
                        ) : (
                            items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                    {item.product_image ? (
                                        <img
                                            src={item.product_image}
                                            alt={item.product_name}
                                            className="w-14 h-14 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center">
                                            <Package className="w-6 h-6 text-slate-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{item.product_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            ₹{item.price} × {item.quantity}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant="secondary" className="mb-1">×{item.quantity}</Badge>
                                        <p className="text-sm font-bold text-primary">₹{item.price * item.quantity}</p>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Total */}
                        <div className="flex justify-between items-center pt-3 border-t mt-3">
                            <span className="font-medium">Total Amount</span>
                            <span className="text-2xl font-bold text-primary">₹{order.total_amount}</span>
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
