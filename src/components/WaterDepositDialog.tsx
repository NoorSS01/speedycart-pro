/**
 * Water Deposit Dialog Component
 * 
 * Shows when user tries to order more 20L water bottles than they own.
 * Allows them to purchase additional bottle deposits.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Droplets, Plus, Minus, AlertCircle, Info } from 'lucide-react';

interface WaterDepositDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bottlesOwned: number;
    requestedQuantity: number;
    depositPerBottle: number;
    onPurchaseDeposit: (count: number) => Promise<boolean>;
    onContinue: () => void;
}

export function WaterDepositDialog({
    open,
    onOpenChange,
    bottlesOwned,
    requestedQuantity,
    depositPerBottle,
    onPurchaseDeposit,
    onContinue,
}: WaterDepositDialogProps) {
    const depositRequired = Math.max(0, requestedQuantity - bottlesOwned);
    const [depositCount, setDepositCount] = useState(depositRequired);
    const [purchasing, setPurchasing] = useState(false);

    const totalDeposit = depositCount * depositPerBottle;

    const handlePurchase = async () => {
        if (depositCount <= 0) return;

        setPurchasing(true);
        const success = await onPurchaseDeposit(depositCount);
        setPurchasing(false);

        if (success) {
            onOpenChange(false);
            onContinue();
        }
    };

    const incrementCount = () => {
        setDepositCount(prev => prev + 1);
    };

    const decrementCount = () => {
        setDepositCount(prev => Math.max(depositRequired, prev - 1));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Droplets className="h-5 w-5 text-blue-500" />
                        Water Bottle Deposit Required
                    </DialogTitle>
                    <DialogDescription>
                        A refundable deposit is required for 20L water bottles
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Current bottles info */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Your Bottles</span>
                            <Badge variant="outline">{bottlesOwned} owned</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Requested</span>
                            <Badge variant="secondary">{requestedQuantity} bottles</Badge>
                        </div>
                    </div>

                    {/* Warning */}
                    {bottlesOwned < requestedQuantity && (
                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-700">
                                    {bottlesOwned === 0
                                        ? "You don't have any bottles yet"
                                        : `You need ${depositRequired} more bottle(s)`
                                    }
                                </p>
                                <p className="text-xs text-amber-600 mt-1">
                                    A ₹{depositPerBottle} refundable deposit is required per bottle
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Deposit quantity selector */}
                    <div className="border rounded-lg p-4">
                        <p className="text-sm font-medium mb-3">Number of bottle deposits to purchase:</p>
                        <div className="flex items-center justify-center gap-4">
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={decrementCount}
                                disabled={depositCount <= depositRequired}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-2xl font-bold w-12 text-center">{depositCount}</span>
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={incrementCount}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-center text-sm text-muted-foreground mt-2">
                            Total Deposit: <span className="font-bold text-primary">₹{totalDeposit}</span>
                        </p>
                    </div>

                    {/* Info about refund */}
                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700">
                            This deposit is fully refundable. When you return your empty bottles,
                            you can get your deposit back or use them for future refills.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handlePurchase} disabled={purchasing || depositCount <= 0}>
                        {purchasing ? 'Processing...' : `Pay ₹${totalDeposit} Deposit`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default WaterDepositDialog;
