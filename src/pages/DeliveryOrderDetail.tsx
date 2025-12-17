import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Truck, CheckCircle, MapPin, Navigation, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function DeliveryOrderDetail() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [assignment, setAssignment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

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
                .single();

            if (!orderData) {
                toast.error('Order not found');
                navigate('/delivery');
                return;
            }
            // Calculate order number (platform-wide daily number)
            const orderDate = new Date(orderData.created_at);
            const dayStart = new Date(orderDate);
            dayStart.setHours(0, 0, 0, 0);

            const { data: dayOrders } = await supabase
                .from('orders')
                .select('id, created_at')
                .gte('created_at', dayStart.toISOString())
                .order('created_at', { ascending: true });

            const orderIndex = (dayOrders || []).findIndex(o => o.id === orderId);
            (orderData as any).orderNumber = orderIndex >= 0 ? orderIndex + 1 : 1;

            setOrder(orderData);

            // Fetch items with variant_id
            const { data: itemsData, error: itemsError } = await supabase
                .from('order_items')
                .select('id, quantity, price, product_id, variant_id')
                .eq('order_id', orderId);

            console.log('Items data:', itemsData, 'Error:', itemsError);

            if (itemsData && (itemsData as any[]).length > 0) {
                // Fetch product names, images, and units
                const productIds = (itemsData as any[]).map(i => i.product_id);
                const { data: products } = await supabase
                    .from('products')
                    .select('id, name, image_url, unit')
                    .in('id', productIds);

                // Fetch variants if any
                const variantIds = (itemsData as any[]).map(i => i.variant_id).filter(Boolean);
                let variantMap = new Map();
                if (variantIds.length > 0) {
                    const { data: variants } = await supabase
                        .from('product_variants')
                        .select('id, variant_value, variant_unit')
                        .in('id', variantIds);
                    variantMap = new Map((variants || []).map(v => [v.id, v]));
                }

                const productMap = new Map((products || []).map(p => [p.id, p]));

                const enrichedItems = (itemsData as any[]).map(item => {
                    const variant = variantMap.get(item.variant_id);
                    // Calculate total quantity for display
                    let calculatedQty = '';
                    if (variant) {
                        // Variant: calculate total (e.g., 2 × 250g = 500g)
                        const totalValue = item.quantity * variant.variant_value;
                        // Format nicely (e.g., 500g, 1kg)
                        if (variant.variant_unit === 'g' && totalValue >= 1000) {
                            calculatedQty = `${(totalValue / 1000).toFixed(1).replace('.0', '')} kg`;
                        } else if (variant.variant_unit === 'ml' && totalValue >= 1000) {
                            calculatedQty = `${(totalValue / 1000).toFixed(1).replace('.0', '')} L`;
                        } else {
                            calculatedQty = `${totalValue} ${variant.variant_unit}`;
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
                });
                setItems(enrichedItems);
            }

            // Fetch assignment
            const { data: assignmentData } = await supabase
                .from('delivery_assignments')
                .select('id, marked_delivered_at')
                .eq('order_id', orderId)
                .single();

            if (assignmentData) setAssignment(assignmentData);

        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const pickOrder = async () => {
        if (!order) return;
        setActionLoading(true);
        await supabase.from('orders').update({ status: 'out_for_delivery' }).eq('id', order.id);
        toast.success('Order picked!');
        fetchData();
        setActionLoading(false);
    };

    const markDelivered = async () => {
        if (!assignment) return;
        setActionLoading(true);
        await supabase.from('delivery_assignments').update({ marked_delivered_at: new Date().toISOString() }).eq('id', assignment.id);
        toast.success('Marked delivered!');
        fetchData();
        setActionLoading(false);
    };

    const openMaps = () => {
        if (order?.delivery_address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`, '_blank');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-4">
                <Skeleton className="h-12 w-full mb-4" />
                <Skeleton className="h-96 w-full rounded-xl" />
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
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/delivery')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="font-bold flex-1">Invoice</h1>
                </div>
            </header>

            {/* Invoice Bill */}
            <div className="p-4">
                <Card className="bg-white dark:bg-slate-800 shadow-lg">
                    <CardContent className="p-0">
                        {/* Invoice Header */}
                        <div className="p-4 border-b text-center bg-primary/5">
                            <h2 className="text-lg font-bold text-primary">DELIVERY INVOICE</h2>
                            <p className="text-sm font-medium">
                                Order #{order.orderNumber || '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                            </p>
                        </div>

                        {/* Address */}
                        <div className="p-4 border-b">
                            <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Deliver To:</p>
                                    <p className="text-sm font-medium">{order.delivery_address}</p>
                                </div>
                                <Button size="sm" variant="outline" className="shrink-0" onClick={openMaps}>
                                    <Navigation className="w-3 h-3 mr-1" />
                                    Map
                                </Button>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="p-4 border-b">
                            <p className="text-xs text-muted-foreground mb-3">ITEMS</p>

                            {items.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Could not load items</p>
                                    <p className="text-xs">(RLS permission issue)</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {/* Items */}
                                    {items.map((item, index) => {
                                        // Calculate total quantity for display
                                        const calcQty = item.calculatedQty || `${item.quantity} ${item.unit}`;
                                        return (
                                            <div key={item.id} className="py-4">
                                                {/* Product Name - Full Width, Larger */}
                                                <p className="font-semibold text-base leading-snug mb-2">
                                                    {index + 1}. {item.name}
                                                </p>
                                                {/* Quantity and Price Row */}
                                                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                                                    <span className="text-sm font-medium text-foreground">{calcQty}</span>
                                                    <span className="text-lg font-bold text-primary">
                                                        ₹{item.quantity * item.price}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Total */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Subtotal</span>
                                <span className="text-sm">₹{order.total_amount}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed">
                                <span className="font-bold text-lg">TOTAL</span>
                                <span className="font-bold text-2xl text-primary">₹{order.total_amount}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center mt-2">
                                Payment: {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Action Button */}
            {(canPick || canDeliver) && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t">
                    {canPick && (
                        <Button className="w-full h-12 bg-primary" onClick={pickOrder} disabled={actionLoading}>
                            <Truck className="w-5 h-5 mr-2" />
                            {actionLoading ? 'Picking...' : 'Pick Up Order'}
                        </Button>
                    )}
                    {canDeliver && (
                        <Button className="w-full h-12 bg-primary" onClick={markDelivered} disabled={actionLoading}>
                            <CheckCircle className="w-5 h-5 mr-2" />
                            {actionLoading ? 'Marking...' : 'Mark Delivered'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
