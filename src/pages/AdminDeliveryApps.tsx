import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Truck, Check, X, Clock, User } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface DeliveryApplication {
    id: string;
    user_id: string;
    full_name: string;
    phone: string;
    vehicle_type: string;
    license_number: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

export default function AdminDeliveryApps() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [applications, setApplications] = useState<DeliveryApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

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
        fetchApplications();
    }, [user, userRole, authLoading, navigate]);

    const fetchApplications = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('delivery_applications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Failed to load applications');
        } else {
            setApplications((data || []) as DeliveryApplication[]);
        }
        setLoading(false);
    };

    const handleAction = async (appId: string, userId: string, action: 'approved' | 'rejected') => {
        setProcessingId(appId);

        const { error: updateError } = await supabase
            .from('delivery_applications')
            .update({ status: action })
            .eq('id', appId);

        if (updateError) {
            toast.error('Failed to update application');
            setProcessingId(null);
            return;
        }

        if (action === 'approved') {
            const { error: roleError } = await supabase
                .from('user_roles')
                .upsert(
                    { user_id: userId, role: 'delivery' },
                    { onConflict: 'user_id,role' }
                );

            if (roleError) {
                toast.error('Failed to assign delivery role');
                setProcessingId(null);
                return;
            }
        }

        toast.success(`Application ${action} successfully`);
        setProcessingId(null);
        fetchApplications();
    };

    const pendingCount = applications.filter(a => a.status === 'pending').length;

    if (authLoading || userRole === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl">
                    <div className="container mx-auto px-4 py-4">
                        <Skeleton className="h-8 w-48" />
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                            <Truck className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Delivery Applications</h1>
                            <p className="text-xs text-muted-foreground">{pendingCount} pending review</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-4">
                {loading ? (
                    [1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)
                ) : applications.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No delivery applications yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    applications.map((app) => (
                        <Card key={app.id} className={app.status === 'pending' ? 'border-amber-200' : ''}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 flex items-center justify-center">
                                            <User className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{app.full_name}</p>
                                            <p className="text-sm text-muted-foreground">{app.phone}</p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={app.status === 'pending' ? 'outline' : app.status === 'approved' ? 'default' : 'destructive'}
                                        className={app.status === 'pending' ? 'border-amber-500 text-amber-600' : app.status === 'approved' ? 'bg-emerald-500' : ''}
                                    >
                                        {app.status}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                                    <div>
                                        <p className="text-muted-foreground">Vehicle</p>
                                        <p className="font-medium capitalize">{app.vehicle_type}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">License</p>
                                        <p className="font-medium">{app.license_number || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-muted-foreground">Applied</p>
                                        <p className="font-medium">{format(new Date(app.created_at), 'MMM dd, yyyy HH:mm')}</p>
                                    </div>
                                </div>

                                {app.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                                            onClick={() => handleAction(app.id, app.user_id, 'approved')}
                                            disabled={processingId === app.id}
                                        >
                                            <Check className="w-4 h-4 mr-1" />
                                            Approve
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={() => handleAction(app.id, app.user_id, 'rejected')}
                                            disabled={processingId === app.id}
                                        >
                                            <X className="w-4 h-4 mr-1" />
                                            Reject
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </main>

            <AdminBottomNav />
        </div>
    );
}
