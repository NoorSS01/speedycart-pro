/**
 * StockConflictDialog - Modal for resolving stock conflicts during checkout
 * 
 * This component displays when checkout fails due to stock issues.
 * It shows affected items and provides resolution options:
 * - Adjust quantities to available stock
 * - Remove unavailable items
 * - Return to cart
 * 
 * Designed for professional quick-commerce UX.
 */

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    AlertTriangle,
    Package,
    Trash2,
    RefreshCw,
    ShoppingCart,
    ArrowRight,
    AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export interface StockConflictItem {
    product_id: string;
    variant_id?: string | null;
    product_name: string;
    variant_name?: string | null;
    requested: number;
    available: number;
    conflict_type: 'out_of_stock' | 'insufficient_stock' | 'product_inactive' | 'not_found' | 'variant_not_found' | 'invalid_quantity';
}

export interface StockConflictDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback when dialog should close */
    onClose: () => void;
    /** List of items with stock conflicts */
    conflictItems: StockConflictItem[];
    /** Callback to adjust cart quantities to available stock */
    onAdjustQuantities: () => Promise<void>;
    /** Callback to remove unavailable items from cart */
    onRemoveUnavailable: () => Promise<void>;
    /** Callback to retry checkout after resolution */
    onRetryCheckout: () => void;
    /** Whether an action is currently in progress */
    isLoading?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StockConflictDialog({
    open,
    onClose,
    conflictItems,
    onAdjustQuantities,
    onRemoveUnavailable,
    onRetryCheckout,
    isLoading = false,
}: StockConflictDialogProps) {
    const [actionInProgress, setActionInProgress] = useState<'adjust' | 'remove' | null>(null);

    // Separate items by type
    const outOfStockItems = conflictItems.filter(
        item => item.conflict_type === 'out_of_stock' ||
            item.conflict_type === 'product_inactive' ||
            item.conflict_type === 'not_found' ||
            item.available === 0
    );

    const insufficientStockItems = conflictItems.filter(
        item => item.conflict_type === 'insufficient_stock' && item.available > 0
    );

    const hasAdjustableItems = insufficientStockItems.length > 0;
    const hasRemovableItems = outOfStockItems.length > 0;

    // Handle adjust quantities
    const handleAdjust = async () => {
        setActionInProgress('adjust');
        try {
            await onAdjustQuantities();
            toast.success('Cart quantities adjusted to available stock');

            // If there are no out-of-stock items, retry checkout
            if (!hasRemovableItems) {
                onRetryCheckout();
            }
        } catch (error) {
            toast.error('Failed to adjust quantities. Please try again.');
        } finally {
            setActionInProgress(null);
        }
    };

    // Handle remove unavailable
    const handleRemove = async () => {
        setActionInProgress('remove');
        try {
            await onRemoveUnavailable();
            toast.success('Unavailable items removed from cart');

            // If there were only out-of-stock items, retry checkout
            if (!hasAdjustableItems) {
                onRetryCheckout();
            }
        } catch (error) {
            toast.error('Failed to remove items. Please try again.');
        } finally {
            setActionInProgress(null);
        }
    };

    // Handle fix all - combines both actions
    const handleFixAll = async () => {
        setActionInProgress('adjust');
        try {
            if (hasRemovableItems) {
                await onRemoveUnavailable();
            }
            if (hasAdjustableItems) {
                await onAdjustQuantities();
            }
            toast.success('Cart updated successfully');
            onRetryCheckout();
        } catch (error) {
            toast.error('Failed to update cart. Please try again.');
        } finally {
            setActionInProgress(null);
        }
    };

    const getConflictTypeLabel = (type: StockConflictItem['conflict_type']): string => {
        switch (type) {
            case 'out_of_stock': return 'Out of Stock';
            case 'insufficient_stock': return 'Limited Stock';
            case 'product_inactive': return 'Unavailable';
            case 'not_found': return 'Not Found';
            case 'variant_not_found': return 'Variant Unavailable';
            case 'invalid_quantity': return 'Invalid Quantity';
            default: return 'Issue';
        }
    };

    const getConflictTypeBadgeVariant = (type: StockConflictItem['conflict_type']): 'destructive' | 'secondary' => {
        if (type === 'out_of_stock' || type === 'product_inactive' || type === 'not_found') {
            return 'destructive';
        }
        return 'secondary';
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        <DialogTitle>Stock Issues Detected</DialogTitle>
                    </div>
                    <DialogDescription>
                        Some items in your cart have stock issues that need to be resolved before checkout.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[300px] pr-4">
                    <div className="space-y-3">
                        {/* Out of Stock Items */}
                        {outOfStockItems.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Unavailable ({outOfStockItems.length})</span>
                                </div>
                                {outOfStockItems.map((item, index) => (
                                    <ConflictItemCard key={`out-${index}`} item={item} getLabel={getConflictTypeLabel} getBadgeVariant={getConflictTypeBadgeVariant} />
                                ))}
                            </div>
                        )}

                        {/* Separator if both types exist */}
                        {outOfStockItems.length > 0 && insufficientStockItems.length > 0 && (
                            <Separator className="my-3" />
                        )}

                        {/* Insufficient Stock Items */}
                        {insufficientStockItems.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Limited Stock ({insufficientStockItems.length})</span>
                                </div>
                                {insufficientStockItems.map((item, index) => (
                                    <ConflictItemCard key={`insuf-${index}`} item={item} getLabel={getConflictTypeLabel} getBadgeVariant={getConflictTypeBadgeVariant} showAdjustment />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <Separator />

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                    {/* Primary Action - Fix All */}
                    <Button
                        onClick={handleFixAll}
                        disabled={isLoading || actionInProgress !== null}
                        className="w-full bg-gradient-to-r from-primary to-primary/90"
                    >
                        {actionInProgress ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Updating Cart...
                            </>
                        ) : (
                            <>
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Fix Issues & Continue
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                        )}
                    </Button>

                    {/* Secondary Actions Row */}
                    <div className="flex gap-2 w-full">
                        {hasRemovableItems && (
                            <Button
                                variant="outline"
                                onClick={handleRemove}
                                disabled={isLoading || actionInProgress !== null}
                                className="flex-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Only
                            </Button>
                        )}
                        {hasAdjustableItems && (
                            <Button
                                variant="outline"
                                onClick={handleAdjust}
                                disabled={isLoading || actionInProgress !== null}
                                className="flex-1"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Adjust Only
                            </Button>
                        )}
                    </div>

                    {/* Cancel */}
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={actionInProgress !== null}
                        className="w-full"
                    >
                        Return to Cart
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ConflictItemCardProps {
    item: StockConflictItem;
    getLabel: (type: StockConflictItem['conflict_type']) => string;
    getBadgeVariant: (type: StockConflictItem['conflict_type']) => 'destructive' | 'secondary';
    showAdjustment?: boolean;
}

function ConflictItemCard({ item, getLabel, getBadgeVariant, showAdjustment = false }: ConflictItemCardProps) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.product_name}</p>
                        {item.variant_name && (
                            <p className="text-xs text-muted-foreground truncate">{item.variant_name}</p>
                        )}
                    </div>
                    <Badge variant={getBadgeVariant(item.conflict_type)} className="flex-shrink-0 text-[10px]">
                        {getLabel(item.conflict_type)}
                    </Badge>
                </div>

                {showAdjustment ? (
                    <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-muted-foreground">Requested: {item.requested}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-amber-600 font-medium">Available: {item.available}</span>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                        Qty: {item.requested} • This item is no longer available
                    </p>
                )}
            </div>
        </div>
    );
}

export default StockConflictDialog;
