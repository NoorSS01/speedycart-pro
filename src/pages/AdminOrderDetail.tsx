import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, MapPin, User, Truck, Timer, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const DEFAULT_DELIVERY_TIME = 30;

export default function AdminOrderDetail() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [customer, setCustomer] = useState<{ name: string; phone: string }>({ name: 'Customer', phone: '' });
    const [deliveryPerson, setDeliveryPerson] = useState<{ name: string; phone: string } | null>(null);
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
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            navigate('/shop');
            return;
        }
        if (orderId) fetchData();
    }, [user, userRole, authLoading, orderId]);

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
                navigate('/admin/orders');
                return;
            }
            setOrder(orderData);

            // Fetch items
            const { data: itemsData } = await supabase
                .from('order_items')
                .select('id, quantity, price, product_id')
                .eq('order_id', orderId);

            if (itemsData && itemsData.length > 0) {
                const productIds = itemsData.map(i => i.product_id);
                const { data: products } = await supabase
                    .from('products')
                    .select('id, name, image_url, unit')
                    .in('id', productIds);

                const productMap = new Map((products || []).map(p => [p.id, p]));
                setItems(itemsData.map(item => ({
                    ...item,
                    name: productMap.get(item.product_id)?.name || 'Product',
                    unit: productMap.get(item.product_id)?.unit || 'pcs'
                })));
            }

            // Fetch customer
            const { data: customerData } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', orderData.user_id)
                .single();

            if (customerData) {
                setCustomer({ name: customerData.full_name || 'Customer', phone: customerData.phone || '' });
            }

            // Fetch assignment & delivery person
            const { data: assignmentData } = await supabase
                .from('delivery_assignments')
                .select('id, delivery_person_id, marked_delivered_at, user_confirmed_at, assigned_at')
                .eq('order_id', orderId)
                .single();

            if (assignmentData) {
                setAssignment(assignmentData);

                // Fetch delivery person details
                if (assignmentData.delivery_person_id) {
                    const { data: dpData } = await supabase
                        .from('profiles')
                        .select('full_name, phone')
                        .eq('id', assignmentData.delivery_person_id)
                        .single();

                    if (dpData) {
                        setDeliveryPerson({ name: dpData.full_name || 'Delivery Partner', phone: dpData.phone || '' });
                    }
                }
            }

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

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            pending: 'bg-amber-500',
            confirmed: 'bg-blue-500',
            out_for_delivery: 'bg-purple-500',
            delivered: 'bg-emerald-500',
            cancelled: 'bg-red-500'
        };
        return <Badge className={colors[status] || 'bg-gray-500'}>{status.replace(/_/g, ' ')}</Badge>;
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

    const isDelivered = assignment?.user_confirmed_at || order.status === 'delivered';
    const isInTransit = order.status === 'out_for_delivery' && !assignment?.marked_delivered_at;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="font-bold">Order #{orderId?.slice(0, 8)}</h1>
                        <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                    </div>
                    {getStatusBadge(order.status)}
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Timer/Delivered Status */}
                {isDelivered ? (
                    <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                        <CardContent className="p-4 flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                            <div>
                                <p className="font-bold text-emerald-700 dark:text-emerald-400">Delivered</p>
                                <p className="text-sm text-emerald-600 dark:text-emerald-300">
                                    {assignment?.user_confirmed_at ? format(new Date(assignment.user_confirmed_at), 'dd MMM, hh:mm a') : 'Confirmed'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : isInTransit ? (
                    <Card className={`border-2 ${getTimeInfo(order.created_at).color === 'red' ? 'border-red-300 bg-red-50' : getTimeInfo(order.created_at).color === 'yellow' ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Timer className={`w-8 h-8 ${getTimeInfo(order.created_at).color === 'red' ? 'text-red-500 animate-pulse' : getTimeInfo(order.created_at).color === 'yellow' ? 'text-amber-500' : 'text-emerald-500'}`} />
                                <div>
                                    <p className="font-bold">Delivery Timer</p>
                                    <p className="text-xs text-muted-foreground">Time remaining</p>
                                </div>
                            </div>
                            <p className={`text-3xl font-mono font-bold ${getTimeInfo(order.created_at).color === 'red' ? 'text-red-600' : getTimeInfo(order.created_at).color === 'yellow' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {getTimeInfo(order.created_at).isExpired ? 'LATE' : getTimeInfo(order.created_at).timeString}
                            </p>
                        </CardContent>
                    </Card>
                ) : null}

                {/* Delivery Partner */}
                {deliveryPerson && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Delivery Partner
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="font-medium">{deliveryPerson.name}</p>
                            <p className="text-sm text-muted-foreground">{deliveryPerson.phone || 'No phone'}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Customer */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Customer
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone || 'No phone'}</p>
                    </CardContent>
                </Card>

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
                            <div key={item.id} className="py-3">
                                <p className="font-semibold text-base mb-1">{index + 1}. {item.name}</p>
                                <div className="flex justify-between items-center bg-muted rounded-lg px-3 py-2">
                                    <span className="text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">{item.quantity}</span> × {item.unit} @ ₹{item.price}
                                    </span>
                                    <span className="text-lg font-bold text-primary">₹{item.quantity * item.price}</span>
                                </div>
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
            </div>
        </div>
    );
}
