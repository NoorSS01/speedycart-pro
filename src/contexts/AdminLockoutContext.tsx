import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { logger } from '@/lib/logger';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CreditCard } from 'lucide-react';

interface AdminLockoutContextType {
    isLocked: boolean;
    lockoutMessage: string;
    checkLockout: () => Promise<void>;
}

const AdminLockoutContext = createContext<AdminLockoutContextType | undefined>(undefined);

export function AdminLockoutProvider({ children }: { children: ReactNode }) {
    const { user, userRole } = useAuth();
    const navigate = useNavigate();
    const [isLocked, setIsLocked] = useState(false);
    const [lockoutMessage, setLockoutMessage] = useState('');

    const checkLockout = useCallback(async () => {
        // Super admins are never locked out
        if (userRole === 'super_admin') {
            setIsLocked(false);
            return;
        }

        // Only check for admin role
        if (userRole !== 'admin') {
            return;
        }

        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('is_locked, payment_message')
                .eq('id', '00000000-0000-0000-0000-000000000001')
                .single();

            if (data) {
                setIsLocked(data.is_locked || false);
                setLockoutMessage(data.payment_message || 'Payment required to continue using admin panel.');
            }
        } catch (error) {
            // Table may not exist yet
            logger.debug('Lockout check skipped', { error });
        }
    }, [userRole]);

    // Check lockout on mount and when user/role changes
    useEffect(() => {
        if (user && userRole) {
            checkLockout();
        }
    }, [user, userRole, checkLockout]);

    // Subscribe to real-time changes
    useEffect(() => {
        if (!user || userRole !== 'admin') return;

        const channel = supabase
            .channel('admin-lockout')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'admin_settings' },
                () => checkLockout()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, userRole, checkLockout]);

    return (
        <AdminLockoutContext.Provider value={{ isLocked, lockoutMessage, checkLockout }}>
            {isLocked && userRole === 'admin' && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="max-w-md w-full border-red-500 shadow-2xl">
                        <CardContent className="p-6 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h2 className="text-xl font-bold text-red-600 mb-2">Admin Access Locked</h2>
                            <p className="text-muted-foreground mb-4">{lockoutMessage}</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Please complete your payment to continue using the admin dashboard.
                            </p>
                            <Button onClick={() => navigate('/admin/to-pay')} className="w-full">
                                <CreditCard className="w-4 h-4 mr-2" />
                                Go to Payments
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
            {children}
        </AdminLockoutContext.Provider>
    );
}

export function useAdminLockout() {
    const context = useContext(AdminLockoutContext);
    if (context === undefined) {
        throw new Error('useAdminLockout must be used within an AdminLockoutProvider');
    }
    return context;
}
