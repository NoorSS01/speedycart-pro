import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import EmptyState from '@/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, ShoppingBag, Search, PackageCheck, Clock, Truck, X, Filter } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface Order {
    id: string;
    created_at: string;
    status: string;
    total_amount: number;
    delivery_address: string;
    user_id: string;
}

export default function AdminOrders() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

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
        fetchOrders();
    }, [user, userRole, authLoading, navigate]);

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            toast.error('Failed to load orders');
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.delivery_address.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        confirmed: orders.filter(o => o.status === 'confirmed').length,
        outForDelivery: orders.filter(o => o.status === 'out_for_delivery').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered':
                return 'bg-emerald-500';
            case 'pending':
                return 'bg-amber-500';
            case 'confirmed':
                return 'bg-blue-500';
            case 'out_for_delivery':
                return 'bg-purple-500';
            case 'cancelled':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'delivered':
                return <PackageCheck className="w-4 h-4" />;
            case 'out_for_delivery':
                return <Truck className="w-4 h-4" />;
            case 'cancelled':
                return <X className="w-4 h-4" />;
            default:
                return <Clock className="w-4 h-4" />;
        }
    };

    if (authLoading || userRole === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl">
                    <div className="container mx-auto px-4 py-4">
                        <Skeleton className="h-8 w-48" />
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </main>
                <AdminBottomNav />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <ShoppingBag className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Orders</h1>
                            <p className="text-xs text-muted-foreground">{stats.total} total orders</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-4">
                {/* Stats Row */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <Button
                        variant={statusFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                        className="shrink-0"
                    >
                        All ({stats.total})
                    </Button>
                    <Button
                        variant={statusFilter === 'pending' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('pending')}
                        className="shrink-0 border-amber-200"
                    >
                        Pending ({stats.pending})
                    </Button>
                    <Button
                        variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('confirmed')}
                        className="shrink-0"
                    >
                        Confirmed ({stats.confirmed})
                    </Button>
                    <Button
                        variant={statusFilter === 'out_for_delivery' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('out_for_delivery')}
                        className="shrink-0"
                    >
                        Out ({stats.outForDelivery})
                    </Button>
                    <Button
                        variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter('delivered')}
                        className="shrink-0"
                    >
                        Delivered ({stats.delivered})
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by order ID or address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Orders List */}
                {loading ? (
                    [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)
                ) : filteredOrders.length === 0 ? (
                    <Card>
                        <CardContent className="p-0">
                            <EmptyState type="orders" title="No orders found" />
                        </CardContent>
                    </Card>
                ) : (
                    filteredOrders.map((order) => (
                        <Card
                            key={order.id}
                            className={`cursor-pointer hover:shadow-md transition-shadow ${order.status === 'pending' ? 'border-amber-200' : ''}`}
                            onClick={() => navigate(`/admin/order/${order.id}`)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-semibold">#{order.id.slice(0, 8)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                                        </p>
                                    </div>
                                    <Badge className={getStatusColor(order.status)}>
                                        <span className="flex items-center gap-1">
                                            {getStatusIcon(order.status)}
                                            {order.status.replace(/_/g, ' ')}
                                        </span>
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-sm text-muted-foreground truncate max-w-[60%]">
                                        {order.delivery_address}
                                    </p>
                                    <p className="font-bold text-lg">₹{order.total_amount}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </main>

            <AdminBottomNav />
        </div>
    );
}
