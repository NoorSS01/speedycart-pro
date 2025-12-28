import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, MapPin, Timer, CheckCircle, Truck, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import BottomNav from '@/components/BottomNav';

const DEFAULT_DELIVERY_TIME = 30;

export default function UserOrderDetail() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [assignment, setAssignment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const deliveryTimeMinutes = parseInt(localStorage.getItem('delivery_time_minutes') || String(DEFAULT_DELIVERY_TIME));

    // Timer update
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
        if (orderId) fetchData();
    }, [user, authLoading, orderId]);

    const fetchData = async () => {
        if (!orderId) return;
        setLoading(true);

        try {
            // Fetch order
            const { data: orderData } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .eq('user_id', user?.id)
                .single();

            if (!orderData) {
                navigate('/orders');
                return;
            }
            setOrder(orderData);

            // Fetch items with variant_id
            const { data: itemsData } = await supabase
                .from('order_items')
                .select('id, quantity, price, product_id, variant_id')
                .eq('order_id', orderId);

            if (itemsData && itemsData.length > 0) {
                const productIds = itemsData.map(i => i.product_id);
                const { data: products } = await supabase
                    .from('products')
                    .select('id, name, image_url, unit')
                    .in('id', productIds);

                // Fetch variants if any
                const variantIds = itemsData.map(i => i.variant_id).filter(Boolean);
                let variantMap = new Map();
                if (variantIds.length > 0) {
                    const { data: variants } = await supabase
                        .from('product_variants')
                        .select('id, variant_value, variant_unit')
                        .in('id', variantIds);
                    variantMap = new Map((variants || []).map(v => [v.id, v]));
                }

                const productMap = new Map((products || []).map(p => [p.id, p]));
                setItems(itemsData.map(item => {
                    const variant = variantMap.get(item.variant_id);

                    // Calculate total quantity for display (same logic as DeliveryOrderDetail)
                    let calculatedQty = '';
                    if (variant) {
                        const totalValue = item.quantity * variant.variant_value;
                        const unit = variant.variant_unit?.toLowerCase() || '';

                        // Handle kg/L - convert to g/ml for display if less than 1kg/L
                        if (unit === 'kg') {
                            const grams = totalValue * 1000;
                            calculatedQty = grams >= 1000 ? `${(grams / 1000).toFixed(1).replace('.0', '')} kg` : `${Math.round(grams)} g`;
                        } else if (unit === 'l' || unit === 'ltr' || unit === 'litre' || unit === 'liter') {
                            const ml = totalValue * 1000;
                            calculatedQty = ml >= 1000 ? `${(ml / 1000).toFixed(1).replace('.0', '')} L` : `${Math.round(ml)} ml`;
                        } else if (unit === 'g' || unit === 'gm' || unit === 'gram') {
                            calculatedQty = totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1).replace('.0', '')} kg` : `${Math.round(totalValue)} g`;
                        } else if (unit === 'ml') {
                            calculatedQty = totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1).replace('.0', '')} L` : `${Math.round(totalValue)} ml`;
                        } else {
                            // For other units (pcs, dozen, etc.)
                            calculatedQty = `${totalValue} ${unit}`;
                        }
                    } else {
                        // No variant - show quantity with product unit
                        calculatedQty = `${item.quantity} ${productMap.get(item.product_id)?.unit || 'pcs'}`;
                    }

                    return {
                        ...item,
                        name: productMap.get(item.product_id)?.name || 'Product',
                        image: productMap.get(item.product_id)?.image_url || null,
                        unit: variant ? `${variant.variant_value}${variant.variant_unit}` : (productMap.get(item.product_id)?.unit || 'pcs'),
                        calculatedQty
                    };
                }));
            }

            // Fetch assignment
            const { data: assignmentData } = await supabase
                .from('delivery_assignments')
                .select('id, marked_delivered_at, user_confirmed_at')
                .eq('order_id', orderId)
                .single();

            if (assignmentData) setAssignment(assignmentData);

        } catch (err) {
            console.error('Error:', err);
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

    const getStatusInfo = (status: string) => {
        const map: Record<string, { color: string; icon: any; label: string }> = {
            pending: { color: 'bg-amber-500', icon: Clock, label: 'Pending' },
            confirmed: { color: 'bg-blue-500', icon: Package, label: 'Confirmed' },
            out_for_delivery: { color: 'bg-purple-500', icon: Truck, label: 'Out for Delivery' },
            delivered: { color: 'bg-emerald-500', icon: CheckCircle, label: 'Delivered' },
            cancelled: { color: 'bg-red-500', icon: Clock, label: 'Cancelled' }
        };
        return map[status] || { color: 'bg-gray-500', icon: Clock, label: status };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-4 pb-24">
                <Skeleton className="h-12 w-full mb-4" />
                <Skeleton className="h-80 w-full rounded-xl" />
                <BottomNav />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center pb-24">
                <p className="text-muted-foreground">Order not found</p>
                <BottomNav />
            </div>
        );
    }

    const isDelivered = assignment?.user_confirmed_at || order.status === 'delivered';
    const isInTransit = order.status === 'out_for_delivery' && !assignment?.marked_delivered_at;
    const statusInfo = getStatusInfo(order.status);

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="font-bold">Order Details</h1>
                        <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                    </div>
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Delivery Status */}
                {isDelivered ? (
                    <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                        <CardContent className="p-4 flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                            <div>
                                <p className="font-bold text-emerald-700 dark:text-emerald-400">Delivered!</p>
                                <p className="text-sm text-emerald-600 dark:text-emerald-300">
                                    {assignment?.user_confirmed_at ? format(new Date(assignment.user_confirmed_at), 'dd MMM, hh:mm a') : 'Order completed'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : isInTransit ? (
                    <Card className={`border-2 ${getTimeInfo(order.created_at).color === 'red' ? 'border-red-300 bg-red-50' : getTimeInfo(order.created_at).color === 'yellow' ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Truck className="w-8 h-8 text-purple-500" />
                                <div>
                                    <p className="font-bold">Your order is on the way!</p>
                                    <p className="text-xs text-muted-foreground">Estimated delivery</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-2xl font-mono font-bold ${getTimeInfo(order.created_at).color === 'red' ? 'text-red-600' : getTimeInfo(order.created_at).color === 'yellow' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {getTimeInfo(order.created_at).isExpired ? 'Arriving soon' : getTimeInfo(order.created_at).timeString}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                        <CardContent className="p-4 flex items-center gap-3">
                            <Package className="w-8 h-8 text-blue-500" />
                            <div>
                                <p className="font-bold text-blue-700 dark:text-blue-400">Preparing your order</p>
                                <p className="text-sm text-blue-600 dark:text-blue-300">Your order will be dispatched soon</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Address */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Delivery Address
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{order.delivery_address}</p>
                    </CardContent>
                </Card>

                {/* Items */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Items ({items.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y">
                        {items.map((item, index) => (
                            <div key={item.id} className="py-3 flex items-center gap-3">
                                {item.image ? (
                                    <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                        <Package className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.calculatedQty || `${item.quantity} ${item.unit}`} @ ₹{item.price}</p>
                                </div>
                                <p className="font-bold text-primary">₹{item.quantity * item.price}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Total */}
                <Card className="bg-primary/5">
                    <CardContent className="p-4 flex justify-between items-center">
                        <span className="font-bold text-lg">Total</span>
                        <span className="text-2xl font-bold text-primary">₹{order.total_amount}</span>
                    </CardContent>
                </Card>

                {/* Payment Info */}
                <div className="text-center text-sm text-muted-foreground">
                    Payment: {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
