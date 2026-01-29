/**
 * useStockMonitor - Real-time stock monitoring hook for cart items
 * 
 * This hook subscribes to Supabase Realtime for product stock changes
 * and provides live stock data for cart items. It enables:
 * - Real-time stock updates without page refresh
 * - Detection of stock conflicts (cart quantity > available stock)
 * - Proactive warnings when stock drops during shopping session
 * 
 * @example
 * ```tsx
 * const { stockMap, conflicts, isLoading, refreshStock } = useStockMonitor(productIds);
 * 
 * // Check if item has conflict
 * const hasConflict = conflicts.has(productId);
 * 
 * // Get current stock for product
 * const stock = stockMap.get(productId)?.stock_quantity ?? 0;
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface StockInfo {
    product_id: string;
    product_name: string;
    stock_quantity: number;
    is_active: boolean;
    price: number;
}

export interface StockConflict {
    product_id: string;
    product_name: string;
    cart_quantity: number;
    available_stock: number;
    conflict_type: 'out_of_stock' | 'insufficient_stock';
}

export interface CartItemForStock {
    product_id: string;
    variant_id: string | null;
    quantity: number;
}

export interface UseStockMonitorResult {
    /** Map of product_id -> current stock info */
    stockMap: Map<string, StockInfo>;
    /** Set of product IDs that have conflicts with cart quantities */
    conflicts: Map<string, StockConflict>;
    /** True while initial stock fetch is in progress */
    isLoading: boolean;
    /** Manually refresh stock data */
    refreshStock: () => Promise<void>;
    /** True if any stock changed since last acknowledgement */
    hasStockChanged: boolean;
    /** Acknowledge stock changes (clears hasStockChanged) */
    acknowledgeChanges: () => void;
    /** List of product IDs that just went out of stock */
    newOutOfStock: string[];
    /** List of product IDs with reduced stock (still > 0) */
    stockReduced: string[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useStockMonitor(
    cartItems: CartItemForStock[],
    options: {
        /** Enable real-time subscription (default: true) */
        enableRealtime?: boolean;
        /** Debounce delay for stock updates in ms (default: 300) */
        debounceMs?: number;
    } = {}
): UseStockMonitorResult {
    const { enableRealtime = true, debounceMs = 300 } = options;

    // State
    const [stockMap, setStockMap] = useState<Map<string, StockInfo>>(new Map());
    const [conflicts, setConflicts] = useState<Map<string, StockConflict>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [hasStockChanged, setHasStockChanged] = useState(false);
    const [newOutOfStock, setNewOutOfStock] = useState<string[]>([]);
    const [stockReduced, setStockReduced] = useState<string[]>([]);

    // Refs for cleanup and debouncing
    const channelRef = useRef<RealtimeChannel | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const previousStockRef = useRef<Map<string, number>>(new Map());
    const cartItemsRef = useRef(cartItems);

    // Keep cartItems ref updated
    useEffect(() => {
        cartItemsRef.current = cartItems;
    }, [cartItems]);

    // Extract unique product IDs from cart items
    const productIds = useMemo(() => {
        const ids = new Set<string>();
        cartItems.forEach(item => ids.add(item.product_id));
        return Array.from(ids);
    }, [cartItems]);

    // Create a map of product_id -> total quantity in cart
    const cartQuantityMap = useMemo(() => {
        const map = new Map<string, number>();
        cartItems.forEach(item => {
            const current = map.get(item.product_id) || 0;
            map.set(item.product_id, current + item.quantity);
        });
        return map;
    }, [cartItems]);

    // ============================================================================
    // FETCH STOCK DATA
    // ============================================================================
    const fetchStock = useCallback(async () => {
        if (productIds.length === 0) {
            setStockMap(new Map());
            setConflicts(new Map());
            setIsLoading(false);
            return;
        }

        try {
            // Direct query to products table - more reliable than RPC for type inference
            const { data, error } = await supabase
                .from('products')
                .select('id, name, stock_quantity, is_active, price')
                .in('id', productIds);

            if (error) {
                logger.error('Failed to fetch stock', { error });
                setIsLoading(false);
                return;
            }

            const newStockMap = new Map<string, StockInfo>();
            const newConflicts = new Map<string, StockConflict>();
            const newOutOfStockItems: string[] = [];
            const reducedStockItems: string[] = [];

            // Process each product's stock info - map from DB fields to interface
            (data || []).forEach((row) => {
                const item: StockInfo = {
                    product_id: row.id,
                    product_name: row.name,
                    stock_quantity: row.stock_quantity ?? 0,
                    is_active: row.is_active ?? true,
                    price: row.price
                };
                newStockMap.set(item.product_id, item);

                // Check for conflicts with cart quantity
                const cartQty = cartQuantityMap.get(item.product_id) || 0;

                if (cartQty > 0) {
                    if (item.stock_quantity <= 0 || !item.is_active) {
                        newConflicts.set(item.product_id, {
                            product_id: item.product_id,
                            product_name: item.product_name,
                            cart_quantity: cartQty,
                            available_stock: item.stock_quantity,
                            conflict_type: 'out_of_stock'
                        });
                    } else if (item.stock_quantity < cartQty) {
                        newConflicts.set(item.product_id, {
                            product_id: item.product_id,
                            product_name: item.product_name,
                            cart_quantity: cartQty,
                            available_stock: item.stock_quantity,
                            conflict_type: 'insufficient_stock'
                        });
                    }

                    // Detect stock changes from previous fetch
                    const prevStock = previousStockRef.current.get(item.product_id);
                    if (prevStock !== undefined) {
                        if (prevStock > 0 && item.stock_quantity <= 0) {
                            newOutOfStockItems.push(item.product_id);
                        } else if (prevStock > item.stock_quantity && item.stock_quantity > 0) {
                            reducedStockItems.push(item.product_id);
                        }
                    }
                }

                // Update previous stock for change detection
                previousStockRef.current.set(item.product_id, item.stock_quantity);
            });

            setStockMap(newStockMap);
            setConflicts(newConflicts);

            if (newOutOfStockItems.length > 0 || reducedStockItems.length > 0) {
                setHasStockChanged(true);
                setNewOutOfStock(newOutOfStockItems);
                setStockReduced(reducedStockItems);
            }

        } catch (e) {
            logger.error('Stock fetch error', { error: e });
        } finally {
            setIsLoading(false);
        }
    }, [productIds, cartQuantityMap]);

    // ============================================================================
    // DEBOUNCED REFRESH
    // ============================================================================
    const debouncedFetchStock = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            fetchStock();
        }, debounceMs);
    }, [fetchStock, debounceMs]);

    // ============================================================================
    // MANUAL REFRESH
    // ============================================================================
    const refreshStock = useCallback(async () => {
        setIsLoading(true);
        await fetchStock();
    }, [fetchStock]);

    // ============================================================================
    // ACKNOWLEDGE CHANGES
    // ============================================================================
    const acknowledgeChanges = useCallback(() => {
        setHasStockChanged(false);
        setNewOutOfStock([]);
        setStockReduced([]);
    }, []);

    // ============================================================================
    // INITIAL FETCH
    // ============================================================================
    useEffect(() => {
        fetchStock();
    }, [fetchStock]);

    // ============================================================================
    // REALTIME SUBSCRIPTION
    // ============================================================================
    useEffect(() => {
        if (!enableRealtime || productIds.length === 0) {
            return;
        }

        // Clean up existing subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        // Subscribe to product changes
        const channel = supabase
            .channel('stock-monitor')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'products',
                    // Only subscribe to products in cart
                    // Note: Supabase filter expression for array containment
                },
                (payload) => {
                    const updatedProductId = payload.new?.id as string;

                    // Only process if this product is in our cart
                    if (productIds.includes(updatedProductId)) {
                        logger.debug('Stock update received', {
                            product_id: updatedProductId,
                            new_stock: payload.new?.stock_quantity,
                            old_stock: payload.old?.stock_quantity
                        });

                        // Debounce to handle rapid updates
                        debouncedFetchStock();
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    logger.debug('Stock monitor subscribed');
                } else if (status === 'CHANNEL_ERROR') {
                    logger.error('Stock monitor subscription error');
                }
            });

        channelRef.current = channel;

        // Cleanup on unmount or when productIds change
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [enableRealtime, productIds, debouncedFetchStock]);

    return {
        stockMap,
        conflicts,
        isLoading,
        refreshStock,
        hasStockChanged,
        acknowledgeChanges,
        newOutOfStock,
        stockReduced
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get stock status label for display
 */
export function getStockStatusLabel(stock: number): {
    label: string;
    variant: 'default' | 'warning' | 'destructive';
} {
    if (stock <= 0) {
        return { label: 'Out of Stock', variant: 'destructive' };
    }
    if (stock <= 5) {
        return { label: `Only ${stock} left`, variant: 'warning' };
    }
    if (stock <= 10) {
        return { label: `${stock} in stock`, variant: 'default' };
    }
    return { label: 'In Stock', variant: 'default' };
}

/**
 * Check if a product has low stock warning threshold
 */
export function isLowStock(stock: number, threshold: number = 5): boolean {
    return stock > 0 && stock <= threshold;
}

/**
 * Check if cart quantity exceeds available stock
 */
export function hasStockConflict(cartQuantity: number, availableStock: number): boolean {
    return cartQuantity > availableStock;
}
