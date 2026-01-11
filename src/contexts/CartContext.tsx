import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
    getGuestCart,
    addToGuestCart as addToGuestCartLib,
    updateGuestCartQuantity as updateGuestCartQtyLib,
    removeFromGuestCart as removeFromGuestCartLib,
    mergeGuestCartToDb,
    GuestCartItem,
} from '@/lib/guestCart';
import { toast } from 'sonner';

interface CartContextType {
    cartItemCount: number;
    refreshCart: () => Promise<void>;
    // Guest cart functions
    addToCart: (productId: string, variantId?: string | null) => Promise<boolean>;
    updateQuantity: (productId: string, variantId: string | null, quantity: number) => Promise<boolean>;
    removeFromCart: (productId: string, variantId?: string | null) => Promise<boolean>;
    getItemQuantity: (productId: string, variantId?: string | null) => number;
    isGuest: boolean;
    guestCartItems: GuestCartItem[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [cartItemCount, setCartItemCount] = useState(0);
    const [guestCartItems, setGuestCartItems] = useState<GuestCartItem[]>([]);
    const [cartQuantities, setCartQuantities] = useState<Map<string, number>>(new Map());
    const previousUserRef = useRef<string | null>(null);

    // Create a unique key for product+variant
    const getCartKey = (productId: string, variantId: string | null = null): string => {
        return variantId ? `${productId}:${variantId}` : productId;
    };

    // Refresh cart - works for both guest and authenticated users
    const refreshCart = useCallback(async () => {
        if (!user) {
            // Guest: use localStorage
            const guestCart = getGuestCart();
            setGuestCartItems(guestCart.items);
            setCartItemCount(guestCart.items.length);

            // Build quantity map for guest cart
            const qtyMap = new Map<string, number>();
            guestCart.items.forEach(item => {
                qtyMap.set(getCartKey(item.productId, item.variantId), item.quantity);
            });
            setCartQuantities(qtyMap);
            return;
        }

        try {
            // Authenticated: fetch from database
            const { data, error } = await supabase
                .from('cart_items')
                .select('id, product_id, variant_id, quantity')
                .eq('user_id', user.id);

            if (!error && data) {
                setCartItemCount(data.length);

                // Build quantity map for DB cart
                const qtyMap = new Map<string, number>();
                data.forEach(item => {
                    qtyMap.set(getCartKey(item.product_id, item.variant_id), item.quantity);
                });
                setCartQuantities(qtyMap);
            }

            // Clear guest cart items state when authenticated
            setGuestCartItems([]);
        } catch (e) {
            logger.error('Error fetching cart', { error: e });
        }
    }, [user]);

    // Add to cart - handles both guest and authenticated
    const addToCart = useCallback(async (
        productId: string,
        variantId: string | null = null
    ): Promise<boolean> => {
        console.log('[CartContext] addToCart called', { productId, variantId, isAuthenticated: !!user, userId: user?.id });

        if (!user) {
            // Guest: add to localStorage
            const success = await addToGuestCartLib(productId, variantId, 1);
            if (success) {
                await refreshCart();
            }
            return success;
        }

        // Authenticated: add to database
        try {
            console.log('[CartContext] Checking for existing cart item...');

            // Check if already in cart - handle null variant_id correctly
            let existingQuery = supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('product_id', productId);

            // CRITICAL: null in PostgreSQL requires .is() not .eq('')
            if (variantId) {
                existingQuery = existingQuery.eq('variant_id', variantId);
            } else {
                existingQuery = existingQuery.is('variant_id', null);
            }

            const { data: existing, error: selectError } = await existingQuery.maybeSingle();

            if (selectError) {
                console.error('[CartContext] Error checking existing item:', selectError);
                logger.error('Error checking existing cart item', { error: selectError });
                return false;
            }

            console.log('[CartContext] Existing item check result:', { existing });

            if (existing) {
                // Update quantity
                console.log('[CartContext] Updating existing item quantity...');
                const { error: updateError } = await supabase
                    .from('cart_items')
                    .update({ quantity: existing.quantity + 1 })
                    .eq('id', existing.id);

                if (updateError) {
                    console.error('[CartContext] Update error:', updateError);
                    logger.error('Error updating cart quantity', { error: updateError });
                    return false;
                }
                console.log('[CartContext] Quantity updated successfully');
            } else {
                // Insert new
                console.log('[CartContext] Inserting new cart item...', {
                    user_id: user.id,
                    product_id: productId,
                    variant_id: variantId,
                });
                const { error: insertError } = await supabase
                    .from('cart_items')
                    .insert({
                        user_id: user.id,
                        product_id: productId,
                        variant_id: variantId,
                        quantity: 1,
                    });

                if (insertError) {
                    console.error('[CartContext] INSERT ERROR:', insertError);
                    console.error('[CartContext] INSERT ERROR CODE:', insertError.code);
                    console.error('[CartContext] INSERT ERROR MESSAGE:', insertError.message);
                    console.error('[CartContext] INSERT ERROR DETAILS:', insertError.details);
                    console.error('[CartContext] INSERT ERROR HINT:', insertError.hint);
                    logger.error('Error inserting to cart', { error: insertError });
                    return false;
                }
                console.log('[CartContext] New item inserted successfully');
            }

            await refreshCart();
            console.log('[CartContext] Cart refreshed');
            return true;
        } catch (e) {
            console.error('[CartContext] Unexpected error:', e);
            logger.error('Error adding to cart', { error: e });
            return false;
        }
    }, [user, refreshCart]);

    // Update quantity - handles both guest and authenticated
    const updateQuantity = useCallback(async (
        productId: string,
        variantId: string | null,
        quantity: number
    ): Promise<boolean> => {
        if (!user) {
            // Guest: update localStorage
            const success = updateGuestCartQtyLib(productId, variantId, quantity);
            if (success) {
                await refreshCart();
            }
            return success;
        }

        // Authenticated: update database
        try {
            if (quantity <= 0) {
                // Remove item - handle null variant_id correctly
                if (variantId) {
                    await supabase
                        .from('cart_items')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('product_id', productId)
                        .eq('variant_id', variantId);
                } else {
                    await supabase
                        .from('cart_items')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('product_id', productId)
                        .is('variant_id', null);
                }
            } else {
                // Update quantity - handle null variant_id correctly
                if (variantId) {
                    await supabase
                        .from('cart_items')
                        .update({ quantity })
                        .eq('user_id', user.id)
                        .eq('product_id', productId)
                        .eq('variant_id', variantId);
                } else {
                    await supabase
                        .from('cart_items')
                        .update({ quantity })
                        .eq('user_id', user.id)
                        .eq('product_id', productId)
                        .is('variant_id', null);
                }
            }

            await refreshCart();
            return true;
        } catch (e) {
            logger.error('Error updating cart quantity', { error: e });
            return false;
        }
    }, [user, refreshCart]);

    // Remove from cart
    const removeFromCart = useCallback(async (
        productId: string,
        variantId: string | null = null
    ): Promise<boolean> => {
        if (!user) {
            const success = removeFromGuestCartLib(productId, variantId);
            if (success) {
                await refreshCart();
            }
            return success;
        }

        try {
            let deleteQuery = supabase
                .from('cart_items')
                .delete()
                .eq('user_id', user.id)
                .eq('product_id', productId);

            // CRITICAL: null in PostgreSQL requires .is() not .eq('')
            if (variantId) {
                deleteQuery = deleteQuery.eq('variant_id', variantId);
            } else {
                deleteQuery = deleteQuery.is('variant_id', null);
            }

            await deleteQuery;

            await refreshCart();
            return true;
        } catch (e) {
            logger.error('Error removing from cart', { error: e });
            return false;
        }
    }, [user, refreshCart]);

    // Get item quantity
    const getItemQuantity = useCallback((
        productId: string,
        variantId: string | null = null
    ): number => {
        const key = getCartKey(productId, variantId);
        return cartQuantities.get(key) || 0;
    }, [cartQuantities]);

    // Refresh cart on user change and initial load
    useEffect(() => {
        refreshCart();
    }, [refreshCart]);

    // Merge guest cart when user logs in
    useEffect(() => {
        const handleMerge = async () => {
            if (user && !previousUserRef.current) {
                // User just logged in - check if there's a guest cart to merge
                const guestCart = getGuestCart();
                if (guestCart.items.length > 0) {
                    logger.info('Merging guest cart on login', { itemCount: guestCart.items.length });
                    const { merged, errors } = await mergeGuestCartToDb(user.id);

                    if (merged > 0) {
                        toast.success(`Added ${merged} item${merged > 1 ? 's' : ''} from your cart`);
                    }

                    if (errors > 0) {
                        toast.error(`Failed to add ${errors} item${errors > 1 ? 's' : ''}`);
                    }

                    // Refresh to show merged cart
                    await refreshCart();
                }
            }
            previousUserRef.current = user?.id || null;
        };

        handleMerge();
    }, [user, refreshCart]);

    // Subscribe to cart changes (authenticated only)
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
        <CartContext.Provider value={{
            cartItemCount,
            refreshCart,
            addToCart,
            updateQuantity,
            removeFromCart,
            getItemQuantity,
            isGuest: !user,
            guestCartItems,
        }}>
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
