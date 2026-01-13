import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, Shield, Clock } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface MaliciousActivity {
    id: string;
    activity_type: string;
    description: string;
    detected_at: string;
    order_id: string | null;
    user_id: string | null;
    delivery_person_id: string | null;
}

export default function AdminSecurity() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [activities, setActivities] = useState<MaliciousActivity[]>([]);
    const [loading, setLoading] = useState(true);

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
        fetchActivities();
    }, [user, userRole, authLoading, navigate]);

    const fetchActivities = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('malicious_activities')
            .select('*')
            .order('detected_at', { ascending: false });

        if (error) {
            toast.error('Failed to load security reports');
        } else {
            setActivities((data || []) as MaliciousActivity[]);
        }
        setLoading(false);
    };

    const getActivityColor = (type: string) => {
        switch (type.toLowerCase()) {
            case 'suspicious_cancellation':
                return 'bg-amber-500';
            case 'fake_delivery':
                return 'bg-red-500';
            case 'fraud':
                return 'bg-red-600';
            default:
                return 'bg-orange-500';
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                            <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Security</h1>
                            <p className="text-xs text-muted-foreground">{activities.length} activity reports</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-4">
                {loading ? (
                    [1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)
                ) : activities.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Shield className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                            <p className="font-medium text-emerald-600">All Clear!</p>
                            <p className="text-sm text-muted-foreground mt-1">No malicious activities detected</p>
                        </CardContent>
                    </Card>
                ) : (
                    activities.map((activity) => (
                        <Card key={activity.id} className="border-red-100">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-xl ${getActivityColor(activity.activity_type)} bg-opacity-20`}>
                                        <AlertTriangle className={`w-5 h-5 ${getActivityColor(activity.activity_type).replace('bg-', 'text-')}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <Badge className={getActivityColor(activity.activity_type)}>
                                                {activity.activity_type.replace(/_/g, ' ')}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(activity.detected_at), 'MMM dd, HH:mm')}
                                            </span>
                                        </div>
                                        <p className="text-sm">{activity.description}</p>

                                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                                            {activity.order_id && (
                                                <span>Order: #{activity.order_id.slice(0, 8)}</span>
                                            )}
                                            {activity.user_id && (
                                                <span>User: {activity.user_id.slice(0, 8)}</span>
                                            )}
                                            {activity.delivery_person_id && (
                                                <span>Delivery: {activity.delivery_person_id.slice(0, 8)}</span>
                                            )}
                                        </div>
                                    </div>
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
