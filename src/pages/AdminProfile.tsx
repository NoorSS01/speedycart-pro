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
    Shield,
    Bell,
    Phone,
    Mail,
    IndianRupee,
    Package,
    Truck,
    Users,
    TrendingUp,
    ShoppingCart,
    Settings,
    Key
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import AdminBottomNav from '@/components/AdminBottomNav';

interface Profile {
    phone: string;
    full_name: string | null;
    email?: string | null;
}

interface PlatformStats {
    totalOrders: number;
    todayOrders: number;
    totalRevenue: number;
    todayRevenue: number;
    totalProducts: number;
    activeDeliveryPartners: number;
    totalCustomers: number;
}

export default function AdminProfile() {
    const { user, userRole, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Profile>({
        phone: '',
        full_name: '',
        email: ''
    });
    const [stats, setStats] = useState<PlatformStats>({
        totalOrders: 0,
        todayOrders: 0,
        totalRevenue: 0,
        todayRevenue: 0,
        totalProducts: 0,
        activeDeliveryPartners: 0,
        totalCustomers: 0
    });
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            navigate('/');
            return;
        }
        fetchData();
    }, [user, userRole, authLoading, navigate]);

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

            // Fetch platform stats
            const now = new Date();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            // Total orders
            const { count: totalOrders } = await supabase
                .from('orders')
                .select('id', { count: 'exact', head: true });

            // Today's orders
            const { data: todayOrdersData } = await supabase
                .from('orders')
                .select('id, total_amount')
                .gte('created_at', todayStart.toISOString());

            // Total revenue
            const { data: allOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('status', 'delivered');

            const totalRevenue = allOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
            const todayRevenue = todayOrdersData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

            // Total products
            const { count: totalProducts } = await supabase
                .from('products')
                .select('id', { count: 'exact', head: true });

            // Delivery partners count
            const { count: deliveryPartners } = await supabase
                .from('user_roles')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'delivery');

            // Total customers
            const { count: totalCustomers } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true });

            setStats({
                totalOrders: totalOrders || 0,
                todayOrders: todayOrdersData?.length || 0,
                totalRevenue,
                todayRevenue,
                totalProducts: totalProducts || 0,
                activeDeliveryPartners: deliveryPartners || 0,
                totalCustomers: totalCustomers || 0
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
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Admin Account</h1>
                    <div className="ml-auto">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium capitalize">
                            {userRole}
                        </span>
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Profile Card */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="w-16 h-16 border-2 border-primary">
                                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                                    {profile.full_name?.[0]?.toUpperCase() || <Shield className="w-6 h-6" />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold">{profile.full_name || 'Admin'}</h2>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {profile.phone || 'No phone'}
                                </p>
                                {profile.email && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> {profile.email}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Platform Overview */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Platform Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-primary">₹{stats.todayRevenue.toFixed(0)}</p>
                                <p className="text-xs text-muted-foreground">Today's Revenue</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold">{stats.todayOrders}</p>
                                <p className="text-xs text-muted-foreground">Today's Orders</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-emerald-600">₹{stats.totalRevenue.toFixed(0)}</p>
                                <p className="text-xs text-muted-foreground">Total Revenue</p>
                            </div>
                            <div className="bg-background rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                                <p className="text-xs text-muted-foreground">Total Orders</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Quick Stats
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-center gap-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <Package className="w-6 h-6 text-blue-600" />
                                <p className="text-lg font-bold">{stats.totalProducts}</p>
                                <p className="text-[10px] text-muted-foreground">Products</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <Truck className="w-6 h-6 text-emerald-600" />
                                <p className="text-lg font-bold">{stats.activeDeliveryPartners}</p>
                                <p className="text-[10px] text-muted-foreground">Partners</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <Users className="w-6 h-6 text-purple-600" />
                                <p className="text-lg font-bold">{stats.totalCustomers}</p>
                                <p className="text-[10px] text-muted-foreground">Customers</p>
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
                            <Settings className="w-4 h-4" />
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

            <AdminBottomNav />
        </div>
    );
}
