import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Megaphone, Shield } from 'lucide-react';
import AdminBroadcastNotifications from '@/components/AdminBroadcastNotifications';
import AdminBottomNav from '@/components/AdminBottomNav';

export default function AdminNotifications() {
    const { user, loading: authLoading, userRole } = useAuth();
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            navigate('/auth');
            return;
        }

        // Check if user is admin
        const hasAdminRole = userRole === 'admin' || userRole === 'super_admin';
        setIsAdmin(hasAdminRole);

        if (!hasAdminRole) {
            navigate('/shop');
        }
    }, [user, userRole, authLoading, navigate]);

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <span>Verifying access...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                            <Megaphone className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Broadcast Center</h1>
                            <p className="text-xs text-muted-foreground">Send notifications to users</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6 max-w-5xl">
                <AdminBroadcastNotifications />
            </main>

            {/* Admin Bottom Navigation */}
            <AdminBottomNav />
        </div>
    );
}
