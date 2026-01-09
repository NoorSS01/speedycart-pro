/**
 * Water Bottle Deposit Management Hook
 * 
 * Manages the 20L water bottle refill deposit system.
 * Users must own bottles (via deposit) before ordering refills.
 * 
 * Features:
 * - Check user's bottle ownership
 * - Get water refill product config
 * - Handle deposit purchases
 * - Validate order eligibility
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { ExtendedDatabase } from '@/types/supabase-ext';
import { Database } from '@/integrations/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';

// Cast supabase to include our new tables
const supabaseTyped = supabase as unknown as SupabaseClient<Database & ExtendedDatabase['public']>;

interface WaterDepositState {
    bottlesOwned: number;
    totalDepositPaid: number;
    loading: boolean;
    error: string | null;
}

interface WaterSettings {
    waterRefillProductId: string | null;
    depositPerBottle: number;
}

interface EligibilityResult {
    eligible: boolean;
    bottlesOwned: number;
    depositRequired: number;
    depositAmount: number;
}

export function useWaterDeposit() {
    const { user } = useAuth();
    const [state, setState] = useState<WaterDepositState>({
        bottlesOwned: 0,
        totalDepositPaid: 0,
        loading: true,
        error: null,
    });
    const [settings, setSettings] = useState<WaterSettings>({
        waterRefillProductId: null,
        depositPerBottle: 100,
    });

    // Fetch user's water deposit info
    const fetchUserDeposit = useCallback(async () => {
        if (!user) {
            setState(prev => ({ ...prev, loading: false, bottlesOwned: 0, totalDepositPaid: 0 }));
            return;
        }

        try {
            const { data, error } = await supabaseTyped
                .from('user_water_deposits')
                .select('bottles_owned, total_deposit_paid')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;

            setState({
                bottlesOwned: data?.bottles_owned ?? 0,
                totalDepositPaid: data?.total_deposit_paid ?? 0,
                loading: false,
                error: null,
            });
        } catch (e) {
            logger.error('Error fetching water deposit', { error: e });
            setState(prev => ({ ...prev, loading: false, error: 'Failed to load deposit info' }));
        }
    }, [user]);

    // Fetch water settings from app_settings
    const fetchSettings = useCallback(async () => {
        try {
            const { data, error } = await supabaseTyped
                .from('app_settings')
                .select('key, value')
                .in('key', ['water_refill_product_id', 'water_deposit_per_bottle']);

            if (error) throw error;

            const settingsMap: Record<string, string> = {};
            data?.forEach((row: { key: string; value: string }) => {
                settingsMap[row.key] = row.value;
            });

            setSettings({
                waterRefillProductId: settingsMap['water_refill_product_id'] !== 'null'
                    ? JSON.parse(settingsMap['water_refill_product_id'])
                    : null,
                depositPerBottle: settingsMap['water_deposit_per_bottle']
                    ? parseFloat(settingsMap['water_deposit_per_bottle'])
                    : 100,
            });
        } catch (e) {
            logger.error('Error fetching water settings', { error: e });
        }
    }, []);

    // Initialize on mount
    useEffect(() => {
        fetchUserDeposit();
        fetchSettings();
    }, [fetchUserDeposit, fetchSettings]);

    // Check if a product is the water refill product
    const isWaterRefillProduct = useCallback((productId: string): boolean => {
        return settings.waterRefillProductId === productId;
    }, [settings.waterRefillProductId]);

    // Check if user can order a specific quantity
    const checkEligibility = useCallback((requestedQuantity: number): EligibilityResult => {
        const bottlesOwned = state.bottlesOwned;

        if (bottlesOwned >= requestedQuantity) {
            return {
                eligible: true,
                bottlesOwned,
                depositRequired: 0,
                depositAmount: 0,
            };
        }

        const depositRequired = requestedQuantity - bottlesOwned;
        return {
            eligible: false,
            bottlesOwned,
            depositRequired,
            depositAmount: depositRequired * settings.depositPerBottle,
        };
    }, [state.bottlesOwned, settings.depositPerBottle]);

    // Purchase additional bottle deposits
    const purchaseDeposit = useCallback(async (bottleCount: number): Promise<boolean> => {
        if (!user) {
            toast.error('Please sign in to purchase bottle deposits');
            return false;
        }

        const depositAmount = bottleCount * settings.depositPerBottle;

        try {
            // Create transaction record
            const { error: txError } = await supabaseTyped
                .from('water_deposit_transactions')
                .insert({
                    user_id: user.id,
                    transaction_type: 'purchase',
                    bottles_count: bottleCount,
                    amount: depositAmount,
                    payment_status: 'completed',
                    notes: `Purchased ${bottleCount} bottle deposit(s) for ₹${depositAmount}`,
                });

            if (txError) throw txError;

            // Update or insert user deposit record
            const { data: existing } = await supabaseTyped
                .from('user_water_deposits')
                .select('id, bottles_owned, total_deposit_paid')
                .eq('user_id', user.id)
                .maybeSingle();

            if (existing) {
                // Update existing record
                const { error: updateError } = await supabaseTyped
                    .from('user_water_deposits')
                    .update({
                        bottles_owned: existing.bottles_owned + bottleCount,
                        total_deposit_paid: existing.total_deposit_paid + depositAmount,
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // Insert new record
                const { error: insertError } = await supabaseTyped
                    .from('user_water_deposits')
                    .insert({
                        user_id: user.id,
                        bottles_owned: bottleCount,
                        total_deposit_paid: depositAmount,
                    });

                if (insertError) throw insertError;
            }

            // Refresh state
            await fetchUserDeposit();

            toast.success(`Purchased ${bottleCount} bottle deposit(s)!`);
            return true;
        } catch (e) {
            logger.error('Error purchasing bottle deposit', { error: e });
            toast.error('Failed to purchase bottle deposit');
            return false;
        }
    }, [user, settings.depositPerBottle, fetchUserDeposit]);

    // Get the maximum quantity user can order for water refill
    const getMaxRefillQuantity = useCallback((): number => {
        return state.bottlesOwned;
    }, [state.bottlesOwned]);

    return {
        // State
        bottlesOwned: state.bottlesOwned,
        totalDepositPaid: state.totalDepositPaid,
        loading: state.loading,
        error: state.error,

        // Settings
        waterRefillProductId: settings.waterRefillProductId,
        depositPerBottle: settings.depositPerBottle,

        // Methods
        isWaterRefillProduct,
        checkEligibility,
        purchaseDeposit,
        getMaxRefillQuantity,
        refreshDeposit: fetchUserDeposit,
    };
}

export default useWaterDeposit;
