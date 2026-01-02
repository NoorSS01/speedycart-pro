import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_DELIVERY_TIME = 30;

export function useDeliveryTime() {
    const [deliveryTimeMinutes, setDeliveryTimeMinutes] = useState<number>(DEFAULT_DELIVERY_TIME);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDeliveryTime();
    }, []);

    const fetchDeliveryTime = async () => {
        try {
            // Type cast needed because admin_settings isn't in generated types
            const { data, error } = await (supabase as any)
                .from('admin_settings')
                .select('delivery_time_minutes')
                .eq('id', '00000000-0000-0000-0000-000000000001')
                .single();

            if (!error && data?.delivery_time_minutes) {
                setDeliveryTimeMinutes(data.delivery_time_minutes);
            } else {
                // Fallback to localStorage if database doesn't have value (backward compatibility)
                const localValue = localStorage.getItem('delivery_time_minutes');
                if (localValue) {
                    setDeliveryTimeMinutes(parseInt(localValue, 10));
                }
            }
        } catch (e) {
            console.error('Failed to fetch delivery time:', e);
            // Fallback to localStorage
            const localValue = localStorage.getItem('delivery_time_minutes');
            if (localValue) {
                setDeliveryTimeMinutes(parseInt(localValue, 10));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const updateDeliveryTime = async (minutes: number) => {
        try {
            // Type cast needed because admin_settings isn't in generated types
            const { error } = await (supabase as any)
                .from('admin_settings')
                .update({ delivery_time_minutes: minutes })
                .eq('id', '00000000-0000-0000-0000-000000000001');

            if (!error) {
                setDeliveryTimeMinutes(minutes);
                // Also update localStorage for backward compatibility during migration
                localStorage.setItem('delivery_time_minutes', minutes.toString());
                return true;
            } else {
                console.error('Failed to update delivery time:', error);
                return false;
            }
        } catch (e) {
            console.error('Failed to update delivery time:', e);
            return false;
        }
    };

    return {
        deliveryTimeMinutes,
        isLoading,
        updateDeliveryTime,
        refreshDeliveryTime: fetchDeliveryTime
    };
}
