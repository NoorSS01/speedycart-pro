import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    upiId: string;
    payeeName: string;
    amount: number;
    onPaymentConfirmed: () => void;
}

export default function PaymentDialog({
    open,
    onOpenChange,
    upiId,
    payeeName,
    amount,
    onPaymentConfirmed
}: PaymentDialogProps) {
    const [step, setStep] = useState<'initial' | 'waiting' | 'confirm'>('initial');
    const [timeLeft, setTimeLeft] = useState(16);
    const [progress, setProgress] = useState(0);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setStep('initial');
            setTimeLeft(16);
            setProgress(0);
        }
    }, [open]);

    // Timer logic
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (step === 'waiting' && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => {
                    const newTime = prev - 0.1; // Update every 100ms for smooth progress
                    return newTime < 0 ? 0 : newTime;
                });
                setProgress((prev) => prev + (100 / (16 * 10)));
            }, 100);
        } else if (step === 'waiting' && timeLeft <= 0) {
            setStep('confirm');
        }
        return () => clearInterval(timer);
    }, [step, timeLeft]);

    const createUpiLink = () => {
        return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('SpeedyCart Payout')}`;
    };

    const handlePayClick = () => {
        const url = createUpiLink();
        window.location.href = url; // Redirect to UPI app
        setStep('waiting');
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            // Prevent closing during countdown unless explicit
            if (step === 'waiting' && val === false) return;
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pay {payeeName}</DialogTitle>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center justify-center space-y-6 text-center">

                    {/* Amount Display */}
                    <div className="bg-muted/50 p-4 rounded-xl w-full">
                        <p className="text-sm text-muted-foreground mb-1">Total Payable</p>
                        <p className="text-4xl font-bold text-primary">₹{amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">{upiId}</p>
                    </div>

                    {/* Steps */}
                    {step === 'initial' && (
                        <div className="w-full space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Click below to open your preferred UPI app. <br />
                                Please verify the UPI ID before paying.
                            </p>
                            <Button size="lg" className="w-full text-lg h-12" onClick={handlePayClick}>
                                <Smartphone className="mr-2 h-5 w-5" /> Pay Now
                            </Button>
                        </div>
                    )}

                    {step === 'waiting' && (
                        <div className="w-full space-y-4 animate-in fade-in duration-500">
                            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                                <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
                                <span className="font-bold text-xl">{Math.ceil(timeLeft)}s</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Waiting for Payment...</h3>
                                <p className="text-sm text-muted-foreground px-4">
                                    Complete the payment in your UPI app. Do not verify anything yet. We will ask for confirmation shortly.
                                </p>
                            </div>
                            <Progress value={Math.min(progress, 100)} className="h-2 w-full" />
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="w-full space-y-4 animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Check className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Did you complete the payment?</h3>
                                <p className="text-sm text-muted-foreground">
                                    The amount will be marked as paid and sent for approval.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full">
                                <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
                                    <X className="mr-2 h-4 w-4" /> No, I didn't
                                </Button>
                                <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={onPaymentConfirmed}>
                                    <Check className="mr-2 h-4 w-4" /> Yes, I Paid
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
