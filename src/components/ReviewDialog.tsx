/**
 * ReviewDialog - Post-delivery review component
 * 
 * PM Spec: 
 * - Top section: Delivery partner name + 5-star rating
 * - Products section: List of products with name (left) + 5-star rating (right)
 * 
 * Layout:
 * ┌────────────────────────────────────────┐
 * │ Delivery Partner: John Doe             │
 * │ ★ ★ ★ ★ ★  (tap to rate)              │
 * └────────────────────────────────────────┘
 * ┌─────────────────────────────────────────┐
 * │ Product Name          │ ★ ★ ★ ★ ★      │
 * ├─────────────────────────────────────────┤
 * │ Product Name 2        │ ★ ★ ★ ★ ★      │
 * └─────────────────────────────────────────┘
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Truck, Package, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface OrderItem {
    id: string;
    name: string;
    image?: string | null;
}

interface ReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    userId: string;
    deliveryPersonId: string;
    deliveryPersonName: string;
    items: OrderItem[];
    onComplete?: () => void;
}

/**
 * 5-Star Rating Component with tap-to-rate interaction
 */
function StarRating({
    rating,
    onRatingChange,
    size = 'md',
}: {
    rating: number;
    onRatingChange: (rating: number) => void;
    size?: 'sm' | 'md' | 'lg';
}) {
    const sizeClasses = {
        sm: 'h-5 w-5',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
    };

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onRatingChange(star)}
                    className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                >
                    <Star
                        className={`${sizeClasses[size]} transition-colors ${star <= rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300'
                            }`}
                    />
                </button>
            ))}
        </div>
    );
}

export default function ReviewDialog({
    open,
    onOpenChange,
    orderId,
    userId,
    deliveryPersonId,
    deliveryPersonName,
    items,
    onComplete,
}: ReviewDialogProps) {
    const [deliveryRating, setDeliveryRating] = useState(0);
    const [productRatings, setProductRatings] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Update product rating
    const handleProductRating = (productId: string, rating: number) => {
        setProductRatings((prev) => ({ ...prev, [productId]: rating }));
    };

    // Check if all required ratings are provided
    const isComplete = deliveryRating > 0;

    // Submit review
    const handleSubmit = async () => {
        if (!isComplete) {
            toast.error('Please rate the delivery partner');
            return;
        }

        setIsSubmitting(true);

        try {
            // Submit delivery rating
            const { error: deliveryError } = await supabase
                .from('delivery_ratings')
                .insert({
                    order_id: orderId,
                    delivery_person_id: deliveryPersonId,
                    user_id: userId,
                    rating: deliveryRating,
                });

            if (deliveryError) {
                // Check if already rated
                if (deliveryError.code === '23505') {
                    toast.info('You have already rated this order');
                } else {
                    throw deliveryError;
                }
            } else {
                logger.info('Delivery rating submitted', {
                    orderId,
                    deliveryPersonId,
                    rating: deliveryRating
                });
            }

            // Product ratings would be submitted here when product_reviews table exists
            // For now, just log them
            if (Object.keys(productRatings).length > 0) {
                logger.info('Product ratings collected (pending table)', {
                    orderId,
                    productRatings
                });
            }

            setSubmitted(true);
            toast.success('Thank you for your feedback!');

            // Close after brief delay to show success state
            setTimeout(() => {
                onOpenChange(false);
                onComplete?.();
            }, 1500);

        } catch (error: any) {
            logger.error('Failed to submit review', { error });
            toast.error('Failed to submit review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle dialog close
    const handleClose = (open: boolean) => {
        if (!open && !submitted) {
            // Allow closing without submitting
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                {submitted ? (
                    // Success State
                    <div className="py-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-green-700">Thank You!</h2>
                        <p className="text-muted-foreground mt-2">
                            Your feedback helps us improve
                        </p>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-lg">How was your order?</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {/* Delivery Partner Rating - TOP SECTION */}
                            <Card className="border-2 border-primary/20 bg-primary/5">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Truck className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Delivery Partner</p>
                                            <p className="font-semibold">{deliveryPersonName || 'Delivery Partner'}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-center">
                                        <StarRating
                                            rating={deliveryRating}
                                            onRatingChange={setDeliveryRating}
                                            size="lg"
                                        />
                                    </div>
                                    <p className="text-xs text-center text-muted-foreground mt-2">
                                        Tap to rate
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Products Section */}
                            {items.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Rate Products (Optional)
                                    </p>
                                    <Card>
                                        <CardContent className="p-0 divide-y">
                                            {items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-3"
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {item.image ? (
                                                            <img
                                                                src={item.image}
                                                                alt={item.name}
                                                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                                                <Package className="w-5 h-5 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                        <p className="text-sm font-medium truncate">
                                                            {item.name}
                                                        </p>
                                                    </div>
                                                    <StarRating
                                                        rating={productRatings[item.id] || 0}
                                                        onRatingChange={(rating) =>
                                                            handleProductRating(item.id, rating)
                                                        }
                                                        size="sm"
                                                    />
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* Submit Button */}
                            <Button
                                onClick={handleSubmit}
                                disabled={!isComplete || isSubmitting}
                                className="w-full"
                                size="lg"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit Review'
                                )}
                            </Button>

                            {/* Skip Option */}
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="w-full text-muted-foreground"
                            >
                                Skip for now
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
