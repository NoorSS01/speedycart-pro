import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft,
    Settings as SettingsIcon,
    User,
    Bell,
    Moon,
    Sun,
    Shield,
    FileText,
    HelpCircle,
    LogOut,
    ChevronRight,
    Phone,
    Mail
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';

export default function Settings() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [profile, setProfile] = useState<{ phone?: string }>({});

    useEffect(() => {
        // Check current theme
        const isDark = document.documentElement.classList.contains('dark');
        setDarkMode(isDark);

        // Fetch profile
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', user.id)
            .single();

        if (data) {
            setProfile(data);
        }
    };

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        if (newMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth');
    };

    const legalLinks = [
        { label: 'Privacy Policy', path: '/privacy-policy', icon: Shield },
        { label: 'Terms & Conditions', path: '/terms', icon: FileText },
        { label: 'Refund Policy', path: '/refund-policy', icon: FileText },
        { label: 'Shipping Policy', path: '/shipping-policy', icon: FileText },
        { label: 'Payment Terms', path: '/payment-terms', icon: FileText },
        { label: 'Grievance Redressal', path: '/grievance', icon: HelpCircle },
        { label: 'Contact Us', path: '/contact', icon: Phone },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                            <SettingsIcon className="h-4 w-4 text-white" />
                        </div>
                        <h1 className="text-lg font-bold">Settings</h1>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-4 max-w-2xl space-y-4">
                {/* Account Info */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <User className="h-5 w-5 text-primary" />
                            Account
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{user?.email}</span>
                            </div>
                        </div>
                        {profile.phone && (
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{profile.phone}</span>
                                </div>
                            </div>
                        )}
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate('/profile')}
                        >
                            Edit Profile
                        </Button>
                    </CardContent>
                </Card>

                {/* Preferences */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                                <Label htmlFor="dark-mode">Dark Mode</Label>
                            </div>
                            <Switch
                                id="dark-mode"
                                checked={darkMode}
                                onCheckedChange={toggleDarkMode}
                            />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Bell className="h-4 w-4" />
                                <Label htmlFor="notifications">Push Notifications</Label>
                            </div>
                            <Switch
                                id="notifications"
                                checked={notifications}
                                onCheckedChange={setNotifications}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Legal & Info */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Legal & Information</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {legalLinks.map((link, index) => (
                            <button
                                key={link.path}
                                onClick={() => navigate(link.path)}
                                className={`w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors ${index < legalLinks.length - 1 ? 'border-b' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <link.icon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{link.label}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                        ))}
                    </CardContent>
                </Card>

                {/* App Info */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center space-y-1">
                            <p className="text-sm font-medium">SpeedyCart Pro</p>
                            <p className="text-xs text-muted-foreground">Version 1.0.0</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Sign Out */}
                <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleSignOut}
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                </Button>
            </main>

            <BottomNav />
        </div>
    );
}
