import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface CartContextType {
    cartItemCount: number;
    refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [cartItemCount, setCartItemCount] = useState(0);

    const refreshCart = useCallback(async () => {
        if (!user) {
            setCartItemCount(0);
            return;
        }

        try {
            const { data, error, count } = await supabase
                .from('cart_items')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id);

            if (!error) {
                // Count unique products (number of different items in cart)
                setCartItemCount(count || 0);
            }
        } catch (e) {
            logger.error('Error fetching cart count', { error: e });
        }
    }, [user]);

    // Refresh cart on user change and initial load
    useEffect(() => {
        refreshCart();
    }, [refreshCart]);

    // Subscribe to cart changes
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('cart_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cart_items',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    refreshCart();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, refreshCart]);

    return (
        <CartContext.Provider value={{ cartItemCount, refreshCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
