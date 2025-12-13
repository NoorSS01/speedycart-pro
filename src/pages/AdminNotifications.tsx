import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import AdminBroadcastNotifications from '@/components/AdminBroadcastNotifications';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Skeleton } from '@/components/ui/skeleton';

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

        // Wait for userRole to be loaded
        if (userRole === null) return;

        // Check if user is admin
        const hasAdminRole = userRole === 'admin' || userRole === 'super_admin';
        setIsAdmin(hasAdminRole);

        // Redirect non-admins to their appropriate page
        if (!hasAdminRole) {
            switch (userRole) {
                case 'delivery':
                    navigate('/delivery');
                    break;
                default:
                    navigate('/shop');
                    break;
            }
        }
    }, [user, userRole, authLoading, navigate]);

    if (authLoading || userRole === null || !isAdmin) {
        return (
            <AdminLayout title="Broadcast Center">
                <main className="space-y-4">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                </main>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Broadcast Center">
            <main className="max-w-5xl">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <Megaphone className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">New Broadcast</h2>
                            <p className="text-sm text-slate-500">Send notifications to all users or specific groups.</p>
                        </div>
                    </div>
                    <AdminBroadcastNotifications />
                </div>
            </main>
        </AdminLayout>
    );
}
