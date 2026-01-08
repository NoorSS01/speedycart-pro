/**
 * Guest Cart System
 * 
 * Provides localStorage-based cart functionality for unauthenticated users.
 * When user authenticates, guest cart is merged with their database cart.
 * 
 * Key Features:
 * - Persistent cart across browser sessions
 * - Product info cached for display
 * - Variant support
 * - Merge logic that preserves quantities
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

const GUEST_CART_KEY = 'speedycart_guest_cart';

export interface GuestCartItem {
    productId: string;
    variantId: string | null;
    quantity: number;
    // Cached product data for display (updated on add)
    productData?: {
        name: string;
        price: number;
        mrp: number | null;
        image_url: string | null;
        unit: string | null;
        stock_quantity: number | null;
    };
    variantData?: {
        variant_name: string;
        variant_value: number;
        variant_unit: string;
        price: number;
        mrp: number | null;
    };
    addedAt: string;
}

export interface GuestCart {
    items: GuestCartItem[];
    updatedAt: string;
}

/**
 * Get the current guest cart from localStorage
 */
export function getGuestCart(): GuestCart {
    try {
        const stored = localStorage.getItem(GUEST_CART_KEY);
        if (stored) {
            const cart = JSON.parse(stored) as GuestCart;
            return cart;
        }
    } catch (e) {
        logger.error('Error reading guest cart', { error: e });
    }
    return { items: [], updatedAt: new Date().toISOString() };
}

/**
 * Save guest cart to localStorage
 */
function saveGuestCart(cart: GuestCart): void {
    try {
        cart.updatedAt = new Date().toISOString();
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    } catch (e) {
        logger.error('Error saving guest cart', { error: e });
    }
}

/**
 * Add item to guest cart
 * If item already exists, increment quantity
 */
export async function addToGuestCart(
    productId: string,
    variantId: string | null = null,
    quantity: number = 1
): Promise<boolean> {
    try {
        const cart = getGuestCart();

        // Check if item already in cart (same product + variant)
        const existingIndex = cart.items.findIndex(
            item => item.productId === productId && item.variantId === variantId
        );

        if (existingIndex >= 0) {
            // Increment quantity
            cart.items[existingIndex].quantity += quantity;
        } else {
            // Fetch product data for caching
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('name, price, mrp, image_url, unit, stock_quantity')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                logger.error('Failed to fetch product for guest cart', { productId, error: productError });
                return false;
            }

            // Fetch variant data if applicable
            let variantData: GuestCartItem['variantData'];
            if (variantId) {
                const { data: variant } = await supabase
                    .from('product_variants')
                    .select('variant_name, variant_value, variant_unit, price, mrp')
                    .eq('id', variantId)
                    .single();

                if (variant) {
                    variantData = variant;
                }
            }

            // Add new item
            cart.items.push({
                productId,
                variantId,
                quantity,
                productData: product,
                variantData,
                addedAt: new Date().toISOString(),
            });
        }

        saveGuestCart(cart);
        logger.debug('Added to guest cart', { productId, variantId, quantity });
        return true;
    } catch (e) {
        logger.error('Error adding to guest cart', { error: e });
        return false;
    }
}

/**
 * Update quantity of an item in guest cart
 */
export function updateGuestCartQuantity(
    productId: string,
    variantId: string | null,
    newQuantity: number
): boolean {
    try {
        const cart = getGuestCart();

        const itemIndex = cart.items.findIndex(
            item => item.productId === productId && item.variantId === variantId
        );

        if (itemIndex >= 0) {
            if (newQuantity <= 0) {
                // Remove item
                cart.items.splice(itemIndex, 1);
            } else {
                cart.items[itemIndex].quantity = newQuantity;
            }
            saveGuestCart(cart);
            return true;
        }
        return false;
    } catch (e) {
        logger.error('Error updating guest cart quantity', { error: e });
        return false;
    }
}

/**
 * Remove item from guest cart
 */
export function removeFromGuestCart(
    productId: string,
    variantId: string | null = null
): boolean {
    try {
        const cart = getGuestCart();

        const initialLength = cart.items.length;
        cart.items = cart.items.filter(
            item => !(item.productId === productId && item.variantId === variantId)
        );

        if (cart.items.length !== initialLength) {
            saveGuestCart(cart);
            return true;
        }
        return false;
    } catch (e) {
        logger.error('Error removing from guest cart', { error: e });
        return false;
    }
}

/**
 * Clear entire guest cart
 */
export function clearGuestCart(): void {
    try {
        localStorage.removeItem(GUEST_CART_KEY);
    } catch (e) {
        logger.error('Error clearing guest cart', { error: e });
    }
}

/**
 * Get total item count in guest cart
 */
export function getGuestCartCount(): number {
    const cart = getGuestCart();
    return cart.items.length;
}

/**
 * Get total quantity of all items in guest cart
 */
export function getGuestCartTotalQuantity(): number {
    const cart = getGuestCart();
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Check if a product is in guest cart
 */
export function isInGuestCart(productId: string, variantId: string | null = null): number {
    const cart = getGuestCart();
    const item = cart.items.find(
        i => i.productId === productId && i.variantId === variantId
    );
    return item?.quantity || 0;
}

/**
 * Merge guest cart into authenticated user's database cart
 * Called after successful authentication
 */
export async function mergeGuestCartToDb(userId: string): Promise<{ merged: number; errors: number }> {
    const cart = getGuestCart();

    if (cart.items.length === 0) {
        return { merged: 0, errors: 0 };
    }

    let merged = 0;
    let errors = 0;

    for (const item of cart.items) {
        try {
            // Check if item already exists in user's DB cart
            const { data: existing } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', userId)
                .eq('product_id', item.productId)
                .eq('variant_id', item.variantId || '')
                .maybeSingle();

            if (existing) {
                // Update quantity (add guest quantity to existing)
                await supabase
                    .from('cart_items')
                    .update({ quantity: existing.quantity + item.quantity })
                    .eq('id', existing.id);
            } else {
                // Insert new cart item
                await supabase
                    .from('cart_items')
                    .insert({
                        user_id: userId,
                        product_id: item.productId,
                        variant_id: item.variantId,
                        quantity: item.quantity,
                    });
            }
            merged++;
        } catch (e) {
            logger.error('Error merging guest cart item', {
                productId: item.productId,
                error: e
            });
            errors++;
        }
    }

    // Clear guest cart after successful merge
    if (errors === 0) {
        clearGuestCart();
    }

    logger.info('Guest cart merged', { merged, errors, userId });
    return { merged, errors };
}

/**
 * Refresh cached product data in guest cart
 * Useful to ensure prices and stock are current
 */
export async function refreshGuestCartProducts(): Promise<void> {
    const cart = getGuestCart();

    if (cart.items.length === 0) return;

    const productIds = cart.items.map(i => i.productId);

    const { data: products } = await supabase
        .from('products')
        .select('id, name, price, mrp, image_url, unit, stock_quantity')
        .in('id', productIds);

    if (!products) return;

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of cart.items) {
        const product = productMap.get(item.productId);
        if (product) {
            item.productData = product;
        }
    }

    saveGuestCart(cart);
}

export default {
    getGuestCart,
    addToGuestCart,
    updateGuestCartQuantity,
    removeFromGuestCart,
    clearGuestCart,
    getGuestCartCount,
    isInGuestCart,
    mergeGuestCartToDb,
    refreshGuestCartProducts,
};
