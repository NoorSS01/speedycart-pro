import { supabase } from '@/integrations/supabase/client';

interface CouponTrigger {
    id: string;
    name: string;
    trigger_type: string;
    conditions: Record<string, any>;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount: number;
    max_discount: number | null;
    coupon_code_prefix: string;
    coupon_valid_days: number;
    max_uses_per_user: number;
}

interface TriggeredCoupon {
    id: string;
    coupon_code: string;
    discount_type: string;
    discount_value: number;
    min_order_amount: number;
    max_discount: number | null;
    valid_until: string;
    is_used: boolean;
}

// Generate a unique coupon code
const generateCouponCode = (prefix: string): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${code}`;
};

// Check if user qualifies for new user trigger
export const checkNewUserTrigger = async (userId: string): Promise<TriggeredCoupon | null> => {
    try {
        // Check if user has any orders
        const { data: orders } = await supabase
            .from('orders')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        // User has orders, not a new user
        if (orders && orders.length > 0) return null;

        // Check if already has a triggered coupon for new_user
        const { data: existingCoupons } = await (supabase as any)
            .from('user_triggered_coupons')
            .select('id')
            .eq('user_id', userId)
            .contains('trigger_id', { trigger_type: 'new_user' });

        if (existingCoupons && existingCoupons.length > 0) return null;

        // Get active new_user triggers
        const { data: triggers } = await (supabase as any)
            .from('coupon_triggers')
            .select('*')
            .eq('trigger_type', 'new_user')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .limit(1);

        if (!triggers || triggers.length === 0) return null;

        const trigger = triggers[0] as CouponTrigger;
        return await createTriggeredCoupon(userId, trigger);
    } catch (error) {
        console.error('Error checking new user trigger:', error);
        return null;
    }
};

// Check if user qualifies for inactivity trigger
export const checkInactivityTrigger = async (userId: string): Promise<TriggeredCoupon | null> => {
    try {
        // Get user's last order
        const { data: orders } = await supabase
            .from('orders')
            .select('created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (!orders || orders.length === 0) return null;

        // Get active inactivity triggers
        const { data: triggers } = await (supabase as any)
            .from('coupon_triggers')
            .select('*')
            .eq('trigger_type', 'inactivity')
            .eq('is_active', true)
            .order('priority', { ascending: false });

        if (!triggers || triggers.length === 0) return null;

        const lastOrderDate = new Date(orders[0].created_at);
        const daysSinceLastOrder = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

        // Find a matching trigger
        for (const trigger of triggers) {
            const daysRequired = trigger.conditions?.days_inactive || 7;
            if (daysSinceLastOrder >= daysRequired) {
                // Check if already has this trigger's coupon
                const { data: existing } = await (supabase as any)
                    .from('user_triggered_coupons')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('trigger_id', trigger.id)
                    .eq('is_used', false);

                if (existing && existing.length > 0) continue;

                return await createTriggeredCoupon(userId, trigger);
            }
        }

        return null;
    } catch (error) {
        console.error('Error checking inactivity trigger:', error);
        return null;
    }
};

// Check if user qualifies for loyalty trigger
export const checkLoyaltyTrigger = async (userId: string): Promise<TriggeredCoupon | null> => {
    try {
        // Get user's order stats
        const { data: orders } = await supabase
            .from('orders')
            .select('id, total_amount')
            .eq('user_id', userId)
            .eq('status', 'delivered');

        if (!orders) return null;

        const orderCount = orders.length;
        const totalSpend = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

        // Get active loyalty triggers
        const { data: triggers } = await (supabase as any)
            .from('coupon_triggers')
            .select('*')
            .eq('trigger_type', 'loyalty')
            .eq('is_active', true)
            .order('priority', { ascending: false });

        if (!triggers || triggers.length === 0) return null;

        // Find a matching trigger
        for (const trigger of triggers) {
            const minOrders = trigger.conditions?.min_orders || 5;
            const minSpend = trigger.conditions?.min_total_spend || 0;

            if (orderCount >= minOrders && totalSpend >= minSpend) {
                // Check if already has this trigger's coupon
                const { data: existing } = await (supabase as any)
                    .from('user_triggered_coupons')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('trigger_id', trigger.id)
                    .eq('is_used', false);

                if (existing && existing.length > 0) continue;

                return await createTriggeredCoupon(userId, trigger);
            }
        }

        return null;
    } catch (error) {
        console.error('Error checking loyalty trigger:', error);
        return null;
    }
};

// Create a triggered coupon for user
const createTriggeredCoupon = async (userId: string, trigger: CouponTrigger): Promise<TriggeredCoupon | null> => {
    try {
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + trigger.coupon_valid_days);

        const couponCode = generateCouponCode(trigger.coupon_code_prefix);

        const { data, error } = await (supabase as any)
            .from('user_triggered_coupons')
            .insert({
                user_id: userId,
                trigger_id: trigger.id,
                coupon_code: couponCode,
                discount_type: trigger.discount_type,
                discount_value: trigger.discount_value,
                min_order_amount: trigger.min_order_amount,
                max_discount: trigger.max_discount,
                valid_until: validUntil.toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return data as TriggeredCoupon;
    } catch (error) {
        console.error('Error creating triggered coupon:', error);
        return null;
    }
};

// Get user's available triggered coupons
export const getUserTriggeredCoupons = async (userId: string): Promise<TriggeredCoupon[]> => {
    try {
        const { data } = await (supabase as any)
            .from('user_triggered_coupons')
            .select('*')
            .eq('user_id', userId)
            .eq('is_used', false)
            .gte('valid_until', new Date().toISOString())
            .order('created_at', { ascending: false });

        return (data || []) as TriggeredCoupon[];
    } catch (error) {
        console.error('Error getting user coupons:', error);
        return [];
    }
};

// Apply a triggered coupon (mark as used)
export const applyTriggeredCoupon = async (couponId: string, orderId: string): Promise<boolean> => {
    try {
        const { error } = await (supabase as any)
            .from('user_triggered_coupons')
            .update({
                is_used: true,
                used_at: new Date().toISOString(),
                order_id: orderId,
            })
            .eq('id', couponId);

        return !error;
    } catch (error) {
        console.error('Error applying coupon:', error);
        return false;
    }
};

// Validate a coupon code and return details
export const validateTriggeredCoupon = async (
    userId: string,
    couponCode: string
): Promise<TriggeredCoupon | null> => {
    try {
        const { data } = await (supabase as any)
            .from('user_triggered_coupons')
            .select('*')
            .eq('user_id', userId)
            .eq('coupon_code', couponCode.toUpperCase())
            .eq('is_used', false)
            .gte('valid_until', new Date().toISOString())
            .single();

        return data as TriggeredCoupon | null;
    } catch (error) {
        return null;
    }
};

// Check all triggers for a user (call on login or shop visit)
export const checkAllTriggers = async (userId: string): Promise<TriggeredCoupon[]> => {
    const triggered: TriggeredCoupon[] = [];

    const newUserCoupon = await checkNewUserTrigger(userId);
    if (newUserCoupon) triggered.push(newUserCoupon);

    const inactivityCoupon = await checkInactivityTrigger(userId);
    if (inactivityCoupon) triggered.push(inactivityCoupon);

    const loyaltyCoupon = await checkLoyaltyTrigger(userId);
    if (loyaltyCoupon) triggered.push(loyaltyCoupon);

    return triggered;
};
