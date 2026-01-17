import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
    freeDeliveryThreshold: number;
    loading: boolean;
    refetch: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettings | undefined>(undefined);

/**
 * AppSettingsProvider - Provides app-wide settings from app_settings table
 * Settings like free delivery threshold are available throughout the app
 */
export function AppSettingsProvider({ children }: { children: ReactNode }) {
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(499); // Default
    const [loading, setLoading] = useState(true);

    const fetchSettings = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings' as any)
                .select('key, value')
                .in('key', ['free_delivery_threshold']);

            if (!error && data) {
                for (const setting of data as any[]) {
                    if (setting.key === 'free_delivery_threshold') {
                        const value = typeof setting.value === 'string'
                            ? parseFloat(setting.value)
                            : setting.value;
                        setFreeDeliveryThreshold(value || 499);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch app settings:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return (
        <AppSettingsContext.Provider value={{
            freeDeliveryThreshold,
            loading,
            refetch: fetchSettings,
        }}>
            {children}
        </AppSettingsContext.Provider>
    );
}

export function useAppSettings() {
    const context = useContext(AppSettingsContext);
    if (context === undefined) {
        throw new Error('useAppSettings must be used within an AppSettingsProvider');
    }
    return context;
}

// Hook for components that optionally use settings (won't throw if no provider)
export function useAppSettingsOptional() {
    return useContext(AppSettingsContext);
}
