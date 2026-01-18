import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    ArrowLeft,
    User,
    LogOut,
    Bell,
    Phone,
    Mail,
    IndianRupee,
    CheckCircle,
    Star,
    TrendingUp,
    Clock,
    Package,
    Power,
    Loader2,
    XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
// date-fns format removed - not currently used

interface Profile {
    phone: string;
    full_name: string | null;
    email?: string | null;
    username?: string | null;
}

interface EarningsStats {
    today: number;
    week: number;
    month: number;
    allTime: number;
    todayDeliveries: number;
    totalDeliveries: number;
    avgRating: number;
}

export default function DeliveryProfile() {
    const { user, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Profile>({
        phone: '',
        full_name: '',
        email: '',
        username: null
    });
    const [stats, setStats] = useState<EarningsStats>({
        today: 0,
        week: 0,
        month: 0,
        allTime: 0,
        todayDeliveries: 0,
        totalDeliveries: 0,
        avgRating: 0
    });
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [activationStatus, setActivationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
    const [requestingActive, setRequestingActive] = useState(false);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [rejectionTime, setRejectionTime] = useState<Date | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchData();
        fetchActivationStatus();
        fetchPayouts();
    }, [user, authLoading, navigate]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Fetch profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('phone, full_name, username')
                .eq('id', user.id)
                .single();

            if (profileData) {
                const pData = profileData as any;
                setProfile({
                    phone: pData.phone || '',
                    full_name: pData.full_name || '',
                    email: user.email || '',
                    username: pData.username || null
                });
            }

            // Fetch delivery stats
            const now = new Date();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - 7);

            const monthStart = new Date(now);
            monthStart.setMonth(monthStart.getMonth() - 1);

            const { data: assignments } = await supabase
                .from('delivery_assignments')
                .select('id, user_confirmed_at')
                .eq('delivery_person_id', user.id)
                .not('user_confirmed_at', 'is', null);

            const completed = assignments || [];
            const todayCompleted = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= todayStart);
            const weekCompleted = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= weekStart);
            const monthCompleted = completed.filter(a => a.user_confirmed_at && new Date(a.user_confirmed_at) >= monthStart);

            // Fetch average rating
            const { data: ratings } = await supabase
                .from('delivery_ratings')
                .select('rating')
                .eq('delivery_person_id', user.id);

            const avgRating = ratings && ratings.length > 0
                ? ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratings.length
                : 0;

            setStats({
                today: todayCompleted.length * 5,
                week: weekCompleted.length * 5,
                month: monthCompleted.length * 5,
                allTime: completed.length * 5,
                todayDeliveries: todayCompleted.length,
                totalDeliveries: completed.length,
                avgRating: Math.round(avgRating * 10) / 10
            });

        } catch (err) {
            logger.error('Error fetching delivery profile data', { error: err });
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        if (!user) return;
        setSaving(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: profile.full_name,
                    username: profile.username?.toLowerCase() || null
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success('Profile updated!');
        } catch (err) {
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth');
    };

    const fetchActivationStatus = async () => {
        if (!user) return;
        const today = new Date().toISOString().split('T')[0];

        try {
            const { data } = await supabase
                .from('delivery_activations')
                .select('status, updated_at')
                .eq('delivery_partner_id', user.id)
                .eq('activation_date', today)
                .maybeSingle();

            if (data && data.status) {
                setActivationStatus(data.status as 'pending' | 'approved' | 'rejected');
                if (data.status === 'rejected' && data.updated_at) {
                    setRejectionTime(new Date(data.updated_at));
                } else {
                    setRejectionTime(null);
                }
            } else {
                setActivationStatus('none');
                setRejectionTime(null);
            }
        } catch (error) {
            logger.debug('Activation status not available');
            setActivationStatus('none');
        }
    };

    // Cooldown timer for rejection
    useEffect(() => {
        if (!rejectionTime || activationStatus !== 'rejected') {
            setCooldownRemaining(0);
            return;
        }

        const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
        const updateCooldown = () => {
            const elapsed = Date.now() - rejectionTime.getTime();
            const remaining = Math.max(0, COOLDOWN_MS - elapsed);
            setCooldownRemaining(remaining);
        };

        updateCooldown();
        const interval = setInterval(updateCooldown, 1000);
        return () => clearInterval(interval);
    }, [rejectionTime, activationStatus]);

    const requestActivation = async () => {
        if (!user) return;
        setRequestingActive(true);

        try {
            const today = new Date().toISOString().split('T')[0];

            // If re-requesting after rejection cooldown, delete the old record first
            if (activationStatus === 'rejected' && cooldownRemaining === 0) {
                await supabase
                    .from('delivery_activations')
                    .delete()
                    .eq('delivery_partner_id', user.id)
                    .eq('activation_date', today);
            }

            const { error } = await supabase
                .from('delivery_activations')
                .insert({
                    delivery_partner_id: user.id,
                    activation_date: today,
                    status: 'pending'
                });

            if (error?.code === '23505') {
                toast.info('You already requested activation today');
                fetchActivationStatus();
            } else if (error) {
                throw error;
            } else {
                toast.success('Activation request sent! Waiting for admin approval.');
                setActivationStatus('pending');
                setRejectionTime(null);
            }
        } catch (error) {
            toast.error('Failed to request activation');
            logger.error('Activation request failed', { error });
        }
        setRequestingActive(false);
    };

    const fetchPayouts = async () => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('payouts' as any)
                .select('*')
                .eq('payee_id', user.id)
                .eq('type', 'delivery_commission')
                .order('created_at', { ascending: false })
                .limit(10);
            if (data) setPayouts(data);
        } catch (e) {
            logger.debug('Payouts fetch failed', { error: e });
        }
    };

    const handlePayoutAction = async (payoutId: string, newStatus: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('payouts' as any)
                .update({ status: newStatus })
                .eq('id', payoutId);
            if (error) throw error;
            toast.success(`Payout ${newStatus}`);
            fetchPayouts();
        } catch (e) {
            toast.error('Failed to update payout');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-4">
                <Skeleton className="h-12 w-full mb-4" />
                <Skeleton className="h-32 w-full mb-4 rounded-xl" />
                <Skeleton className="h-48 w-full mb-4 rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/delivery')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">My Account</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Profile Card */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="w-16 h-16 border-2 border-primary">
                                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                                    {profile.full_name?.[0]?.toUpperCase() || <User className="w-6 h-6" />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold">{profile.full_name || 'Delivery Partner'}</h2>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {profile.phone || 'No phone'}
                                </p>
                                {profile.email && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> {profile.email}
                                    </p>
                                )}
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-amber-500">
                                    <Star className="w-5 h-5 fill-current" />
                                    <span className="text-lg font-bold">{stats.avgRating || '—'}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Rating</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Daily Activation Card */}
                <Card className={activationStatus === 'approved' ? 'border-green-500 bg-green-500/5' : activationStatus === 'pending' ? 'border-amber-500 bg-amber-500/5' : ''}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${activationStatus === 'approved' ? 'bg-green-500' :
                                    activationStatus === 'pending' ? 'bg-amber-500' :
                                        activationStatus === 'rejected' ? 'bg-red-500' : 'bg-muted'
                                    }`}>
                                    {activationStatus === 'approved' ? (
                                        <CheckCircle className="w-6 h-6 text-white" />
                                    ) : activationStatus === 'pending' ? (
                                        <Clock className="w-6 h-6 text-white" />
                                    ) : activationStatus === 'rejected' ? (
                                        <XCircle className="w-6 h-6 text-white" />
                                    ) : (
                                        <Power className="w-6 h-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold">
                                        {activationStatus === 'approved' ? 'Active Today' :
                                            activationStatus === 'pending' ? 'Awaiting Approval' :
                                                activationStatus === 'rejected' ? 'Request Rejected' :
                                                    'Not Active'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {activationStatus === 'approved' ? 'You can receive orders' :
                                            activationStatus === 'pending' ? 'Admin will review shortly' :
                                                activationStatus === 'rejected' ? 'Contact admin for details' :
                                                    'Request to go active for today'}
                                    </p>
                                </div>
                            </div>
                            {activationStatus === 'none' && (
                                <Button onClick={requestActivation} disabled={requestingActive}>
                                    {requestingActive ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Power className="w-4 h-4 mr-2" />
                                    )}
                                    {requestingActive ? 'Requesting...' : 'Go Active'}
                                </Button>
                            )}
                            {activationStatus === 'rejected' && cooldownRemaining === 0 && (
                                <Button onClick={requestActivation} disabled={requestingActive}>
                                    {requestingActive ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Power className="w-4 h-4 mr-2" />
                                    )}
                                    {requestingActive ? 'Requesting...' : 'Request Again'}
                                </Button>
                            )}
                            {activationStatus === 'rejected' && cooldownRemaining > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    Wait {Math.ceil(cooldownRemaining / 60000)}m {Math.floor((cooldownRemaining % 60000) / 1000)}s
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Payouts Section */}
                <div>
                    <h2 className="font-semibold mb-3">Recent Payouts</h2>
                    <div className="space-y-3">
                        {payouts.length === 0 ? (
                            <Card><CardContent className="p-4 text-center text-muted-foreground">No payment history</CardContent></Card>
                        ) : (
                            payouts.map(pay => (
                                <Card key={pay.id} className="overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-lg">₹{pay.amount}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(pay.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <Badge variant={pay.status === 'approved' ? 'default' : pay.status === 'pending' ? 'outline' : 'destructive'}>
                                                {pay.status}
                                            </Badge>
                                        </div>

                                        {pay.status === 'pending' && (
                                            <div className="mt-3 flex gap-2">
                                                <Button size="sm" variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handlePayoutAction(pay.id, 'rejected')}>
                                                    Reject
                                                </Button>
                                                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handlePayoutAction(pay.id, 'approved')}>
                                                    Confirm Receipt
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Earnings Overview */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <IndianRupee className="w-4 h-4" />
                            Earnings Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-primary">₹{stats.today}</p>
                                <p className="text-xs text-muted-foreground">Today</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-primary">₹{stats.week}</p>
                                <p className="text-xs text-muted-foreground">This Week</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-primary">₹{stats.month}</p>
                                <p className="text-xs text-muted-foreground">This Month</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-primary">₹{stats.allTime}</p>
                                <p className="text-xs text-muted-foreground">All Time</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Delivery Stats */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Delivery Statistics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <Package className="w-8 h-8 text-emerald-600" />
                                <div>
                                    <p className="text-xl font-bold">{stats.todayDeliveries}</p>
                                    <p className="text-xs text-muted-foreground">Today</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <CheckCircle className="w-8 h-8 text-blue-600" />
                                <div>
                                    <p className="text-xl font-bold">{stats.totalDeliveries}</p>
                                    <p className="text-xs text-muted-foreground">Total</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Profile */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Edit Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Full Name</Label>
                            <Input
                                value={profile.full_name || ''}
                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                placeholder="Your name"
                            />
                        </div>
                        <div>
                            <Label>Username</Label>
                            <div className="flex">
                                <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm font-medium text-muted-foreground">
                                    @
                                </div>
                                <Input
                                    value={profile.username || ''}
                                    onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) })}
                                    placeholder="your_username"
                                    className="rounded-l-none"
                                    maxLength={20}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Letters, numbers, underscores (3-20 chars)</p>
                        </div>
                        <div>
                            <Label>Phone Number</Label>
                            <Input
                                value={profile.phone}
                                disabled
                                className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Contact support to change phone number</p>
                        </div>
                        <Button onClick={saveProfile} disabled={saving} className="w-full">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Settings */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Bell className="w-4 h-4" />
                            Settings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">Push Notifications</span>
                            </div>
                            <Switch
                                checked={notificationsEnabled}
                                onCheckedChange={setNotificationsEnabled}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Separator />

                {/* Sign Out */}
                <Button variant="destructive" className="w-full" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </Button>
            </div>
        </div>
    );
}
