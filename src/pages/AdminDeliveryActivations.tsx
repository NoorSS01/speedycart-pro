import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
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
    const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; requestId: string | null; hours: number }>({
        open: false,
        requestId: null,
        hours: 8
    });

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

            // First, fetch activations for today
            const { data: activationsData, error: activationsError } = await supabase
                .from('delivery_activations')
                .select('id, delivery_partner_id, activation_date, status, created_at')
                .eq('activation_date', today)
                .order('created_at', { ascending: false });

            if (activationsError) {
                logger.error('Failed to fetch activations', { error: activationsError });
                setLoading(false);
                return;
            }

            if (!activationsData || activationsData.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            // Get unique partner IDs
            const partnerIds = [...new Set(activationsData.map(a => a.delivery_partner_id))];

            // Fetch profiles for these partners
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, full_name, phone')
                .in('id', partnerIds);

            // Create a map for quick lookup
            const profilesMap = new Map(
                (profilesData || []).map(p => [p.id, { full_name: p.full_name, phone: p.phone }])
            );

            // Combine activations with profiles
            const combinedData: ActivationRequest[] = activationsData.map(a => ({
                id: a.id,
                delivery_partner_id: a.delivery_partner_id,
                activation_date: a.activation_date,
                status: a.status || 'pending',
                created_at: a.created_at || new Date().toISOString(),
                profiles: profilesMap.get(a.delivery_partner_id) || null
            }));

            setRequests(combinedData);
        } catch (error) {
            logger.error('Failed to fetch delivery activation requests', { error });
        }
        setLoading(false);
    };

    const updateStatus = async (id: string, status: 'approved' | 'rejected', durationHours?: number) => {
        try {
            const updateData: any = {
                status,
                admin_id: user?.id,
                updated_at: new Date().toISOString()
            };

            // If approving, set the expiry time
            if (status === 'approved' && durationHours) {
                const approvedUntil = new Date();
                approvedUntil.setHours(approvedUntil.getHours() + durationHours);
                updateData.approved_until = approvedUntil.toISOString();
                updateData.duration_hours = durationHours;
            }

            await supabase
                .from('delivery_activations')
                .update(updateData)
                .eq('id', id);

            toast.success(`Request ${status}${status === 'approved' ? ` for ${durationHours}h` : ''}`);
            setApprovalDialog({ open: false, requestId: null, hours: 8 });
            fetchRequests();
        } catch (error) {
            toast.error('Failed to update request');
        }
    };

    const openApprovalDialog = (requestId: string) => {
        setApprovalDialog({ open: true, requestId, hours: 8 });
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
                                                    onClick={() => openApprovalDialog(req.id)}
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

            {/* Approval Duration Dialog */}
            {approvalDialog.open && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Set Activation Duration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                How long should this activation be valid?
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                                {[4, 6, 8, 10, 12, 16, 20, 24].map(h => (
                                    <Button
                                        key={h}
                                        variant={approvalDialog.hours === h ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setApprovalDialog(prev => ({ ...prev, hours: h }))}
                                    >
                                        {h}h
                                    </Button>
                                ))}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setApprovalDialog({ open: false, requestId: null, hours: 8 })}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 bg-green-500 hover:bg-green-600"
                                    onClick={() => approvalDialog.requestId && updateStatus(approvalDialog.requestId, 'approved', approvalDialog.hours)}
                                >
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve for {approvalDialog.hours}h
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <AdminBottomNav />
        </div>
    );
}
