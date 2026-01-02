import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Check, X, Power, Clock, User } from 'lucide-react';
import { toast } from 'sonner';
import AdminBottomNav from '@/components/AdminBottomNav';
import { format } from 'date-fns';

interface ActivationRequest {
    id: string;
    delivery_partner_id: string;
    activation_date: string;
    status: string;
    created_at: string;
    profiles: {
        full_name: string | null;
        phone: string | null;
    } | null;
}

export default function AdminDeliveryActivations() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [requests, setRequests] = useState<ActivationRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    useEffect(() => {
        if (authLoading) return;
        if (!user || !isAdmin) {
            navigate('/');
            return;
        }
        fetchRequests();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchRequests = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const { data } = await (supabase as any)
                .from('delivery_activations')
                .select(`
                    id, delivery_partner_id, activation_date, status, created_at,
                    profiles:delivery_partner_id(full_name, phone)
                `)
                .eq('activation_date', today)
                .order('created_at', { ascending: false });

            if (data) setRequests(data);
        } catch (error) {
            console.error('Error fetching requests:', error);
        }
        setLoading(false);
    };

    const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await (supabase as any)
                .from('delivery_activations')
                .update({ status, admin_id: user?.id, updated_at: new Date().toISOString() })
                .eq('id', id);

            toast.success(`Request ${status}`);
            fetchRequests();
        } catch (error) {
            toast.error('Failed to update request');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pb-20">
                <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-6 w-48" />
                    </div>
                </header>
                <div className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            </div>
        );
    }

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const processedRequests = requests.filter(r => r.status !== 'pending');

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold">Delivery Activations</h1>
                            <p className="text-xs text-muted-foreground">
                                Today - {format(new Date(), 'PPP')}
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {pendingRequests.length} pending
                    </Badge>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                    <div>
                        <h2 className="font-semibold mb-3 flex items-center gap-2">
                            <Power className="h-4 w-4 text-amber-500" />
                            Pending Requests
                        </h2>
                        <div className="space-y-3">
                            {pendingRequests.map(req => (
                                <Card key={req.id} className="border-amber-500/50">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-amber-500" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">
                                                        {req.profiles?.full_name || 'Delivery Partner'}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {req.profiles?.phone || 'No phone'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                                                    onClick={() => updateStatus(req.id, 'rejected')}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-green-500 hover:bg-green-600"
                                                    onClick={() => updateStatus(req.id, 'approved')}
                                                >
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Approve
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* No Pending */}
                {pendingRequests.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Power className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No pending activation requests</p>
                        </CardContent>
                    </Card>
                )}

                {/* Processed Requests */}
                {processedRequests.length > 0 && (
                    <div>
                        <h2 className="font-semibold mb-3 text-sm text-muted-foreground">
                            Processed Today
                        </h2>
                        <div className="space-y-2">
                            {processedRequests.map(req => (
                                <Card key={req.id} className="opacity-75">
                                    <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${req.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                                                    }`}>
                                                    {req.status === 'approved' ? (
                                                        <Check className="h-4 w-4 text-white" />
                                                    ) : (
                                                        <X className="h-4 w-4 text-white" />
                                                    )}
                                                </div>
                                                <span className="text-sm">
                                                    {req.profiles?.full_name || 'Partner'}
                                                </span>
                                            </div>
                                            <Badge variant={req.status === 'approved' ? 'default' : 'destructive'}>
                                                {req.status}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <AdminBottomNav />
        </div>
    );
}
