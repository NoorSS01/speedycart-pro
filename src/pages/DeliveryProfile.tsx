import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
    Truck,
    Bell,
    Phone,
    Mail,
    IndianRupee,
    CheckCircle,
    Star,
    Calendar,
    TrendingUp,
    Clock,
    Package
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface Profile {
    phone: string;
    full_name: string | null;
    email?: string | null;
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
        email: ''
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

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchData();
    }, [user, authLoading, navigate]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Fetch profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('phone, full_name')
                .eq('id', user.id)
                .single();

            if (profileData) {
                setProfile({
                    phone: profileData.phone || '',
                    full_name: profileData.full_name || '',
                    email: user.email || ''
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
                ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
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
            console.error('Error fetching data:', err);
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
                    phone: profile.phone
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
                            <Label>Phone Number</Label>
                            <Input
                                value={profile.phone}
                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                placeholder="+91 XXXXX XXXXX"
                            />
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
