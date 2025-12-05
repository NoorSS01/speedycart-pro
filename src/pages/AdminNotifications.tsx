import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Megaphone, Shield } from 'lucide-react';
import AdminBroadcastNotifications from '@/components/AdminBroadcastNotifications';

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
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                                <Megaphone className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Broadcast Center</h1>
                                <p className="text-xs text-muted-foreground">Send notifications to users</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6 max-w-5xl">
                <AdminBroadcastNotifications />
            </main>
        </div>
    );
}
