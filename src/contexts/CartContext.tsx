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
    cartTotal: number; // Total cart value in INR - single source of truth
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
    const [cartTotal, setCartTotal] = useState(0); // Track total cart value
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

            // Calculate total from guest cart items
            const total = guestCart.items.reduce((sum, item) => {
                const price = item.variantData?.price ?? item.productData?.price ?? 0;
                return sum + price * item.quantity;
            }, 0);
            setCartTotal(total);

            // Build quantity map for guest cart
            const qtyMap = new Map<string, number>();
            guestCart.items.forEach(item => {
                qtyMap.set(getCartKey(item.productId, item.variantId), item.quantity);
            });
            setCartQuantities(qtyMap);
            return;
        }

        try {
            // Authenticated: fetch from database WITH PRICES for total calculation
            const { data, error } = await supabase
                .from('cart_items')
                .select('id, product_id, variant_id, quantity, products(price), product_variants(price)')
                .eq('user_id', user.id);

            if (!error && data) {
                setCartItemCount(data.length);

                // Calculate total from fetched data
                const total = data.reduce((sum, item) => {
                    const products = item.products as { price: number } | null;
                    const variants = item.product_variants as { price: number } | null;
                    const price = variants?.price ?? products?.price ?? 0;
                    return sum + price * item.quantity;
                }, 0);
                setCartTotal(total);

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
    // OPTIMISTIC UPDATES: UI updates immediately, DB syncs in background
    const addToCart = useCallback(async (
        productId: string,
        variantId: string | null = null
    ): Promise<boolean> => {
        console.log('[CartContext] addToCart called', { productId, variantId, isAuthenticated: !!user, userId: user?.id });

        const cartKey = getCartKey(productId, variantId);
        const currentQty = cartQuantities.get(cartKey) || 0;
        const newQty = currentQty + 1;

        // OPTIMISTIC UPDATE: Update UI immediately before DB operation
        setCartQuantities(prev => new Map(prev).set(cartKey, newQty));
        setCartItemCount(prev => currentQty === 0 ? prev + 1 : prev);

        if (!user) {
            // Guest: add to localStorage (fast, local operation)
            const success = await addToGuestCartLib(productId, variantId, 1);
            if (success) {
                // Refresh to sync total (still optimistic since localStorage is instant)
                refreshCart();
            } else {
                // Revert optimistic update on failure
                setCartQuantities(prev => {
                    const next = new Map(prev);
                    if (currentQty === 0) {
                        next.delete(cartKey);
                    } else {
                        next.set(cartKey, currentQty);
                    }
                    return next;
                });
                setCartItemCount(prev => currentQty === 0 ? prev - 1 : prev);
            }
            return success;
        }

        // Authenticated: Sync to database in background (non-blocking)
        // Use upsert pattern for single DB call instead of check + insert/update
        (async () => {
            try {
                // Single query: insert or update using Supabase's upsert
                // We need to handle the upsert manually since cart_items may have
                // a constraint on (user_id, product_id, variant_id)

                // First, try to get existing item
                let query = supabase
                    .from('cart_items')
                    .select('id, quantity')
                    .eq('user_id', user.id)
                    .eq('product_id', productId);

                if (variantId) {
                    query = query.eq('variant_id', variantId);
                } else {
                    query = query.is('variant_id', null);
                }

                const { data: existing, error: selectError } = await query.maybeSingle();

                if (selectError) {
                    console.error('[CartContext] Error checking existing item:', selectError);
                    throw selectError;
                }

                if (existing) {
                    // Update quantity
                    const { error: updateError } = await supabase
                        .from('cart_items')
                        .update({ quantity: existing.quantity + 1 })
                        .eq('id', existing.id);

                    if (updateError) throw updateError;
                } else {
                    // Insert new
                    const { error: insertError } = await supabase
                        .from('cart_items')
                        .insert({
                            user_id: user.id,
                            product_id: productId,
                            variant_id: variantId,
                            quantity: 1,
                        });

                    if (insertError) throw insertError;
                }

                // Success - refresh cart in background to sync totals
                // Don't await - keep UI responsive
                refreshCart();

            } catch (e) {
                console.error('[CartContext] DB sync failed, reverting optimistic update:', e);
                logger.error('Error adding to cart', { error: e });

                // REVERT optimistic update on DB failure
                setCartQuantities(prev => {
                    const next = new Map(prev);
                    if (currentQty === 0) {
                        next.delete(cartKey);
                    } else {
                        next.set(cartKey, currentQty);
                    }
                    return next;
                });
                setCartItemCount(prev => currentQty === 0 ? prev - 1 : prev);

                toast.error('Failed to add to cart. Please try again.');
            }
        })();

        // Return immediately - DB operation happens in background
        return true;
    }, [user, refreshCart, cartQuantities]);

    // Update quantity - handles both guest and authenticated
    // OPTIMISTIC UPDATES: UI updates immediately, DB syncs in background
    const updateQuantity = useCallback(async (
        productId: string,
        variantId: string | null,
        quantity: number
    ): Promise<boolean> => {
        const cartKey = getCartKey(productId, variantId);
        const currentQty = cartQuantities.get(cartKey) || 0;

        // OPTIMISTIC UPDATE: Update UI immediately
        if (quantity <= 0) {
            // Remove from cart
            setCartQuantities(prev => {
                const next = new Map(prev);
                next.delete(cartKey);
                return next;
            });
            setCartItemCount(prev => Math.max(0, prev - 1));
        } else {
            // Update quantity
            setCartQuantities(prev => new Map(prev).set(cartKey, quantity));
            // Cart count only changes if adding new item (handled in addToCart)
        }

        if (!user) {
            // Guest: update localStorage (fast, local operation)
            const success = updateGuestCartQtyLib(productId, variantId, quantity);
            if (success) {
                refreshCart();
            } else {
                // Revert optimistic update
                setCartQuantities(prev => {
                    const next = new Map(prev);
                    if (currentQty === 0) {
                        next.delete(cartKey);
                    } else {
                        next.set(cartKey, currentQty);
                    }
                    return next;
                });
                if (quantity <= 0) setCartItemCount(prev => prev + 1);
            }
            return success;
        }

        // Authenticated: Sync to database in background (non-blocking)
        (async () => {
            try {
                if (quantity <= 0) {
                    // Remove item
                    let deleteQuery = supabase
                        .from('cart_items')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('product_id', productId);

                    if (variantId) {
                        deleteQuery = deleteQuery.eq('variant_id', variantId);
                    } else {
                        deleteQuery = deleteQuery.is('variant_id', null);
                    }

                    const { error } = await deleteQuery;
                    if (error) throw error;
                } else {
                    // Update quantity
                    let updateQuery = supabase
                        .from('cart_items')
                        .update({ quantity })
                        .eq('user_id', user.id)
                        .eq('product_id', productId);

                    if (variantId) {
                        updateQuery = updateQuery.eq('variant_id', variantId);
                    } else {
                        updateQuery = updateQuery.is('variant_id', null);
                    }

                    const { error } = await updateQuery;
                    if (error) throw error;
                }

                // Success - refresh total in background
                refreshCart();

            } catch (e) {
                console.error('[CartContext] DB sync failed, reverting optimistic update:', e);
                logger.error('Error updating cart quantity', { error: e });

                // REVERT optimistic update on DB failure
                setCartQuantities(prev => {
                    const next = new Map(prev);
                    if (currentQty === 0) {
                        next.delete(cartKey);
                    } else {
                        next.set(cartKey, currentQty);
                    }
                    return next;
                });
                if (quantity <= 0) setCartItemCount(prev => prev + 1);

                toast.error('Failed to update cart. Please try again.');
            }
        })();

        // Return immediately - DB operation happens in background
        return true;
    }, [user, refreshCart, cartQuantities]);

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
            cartTotal,
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
