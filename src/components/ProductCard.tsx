import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVariantDisplay } from '@/lib/formatUnit';
import { useTheme } from '@/contexts/ThemeContext';
import { QuantityControls } from '@/components/ui/QuantityControls';
import { toast } from 'sonner';

interface ProductVariant {
    price: number;
    mrp: number | null;
    variant_name: string;
    variant_value: number;
    variant_unit: string | null;
}

interface ProductCardProps {
    product: {
        id: string;
        name: string;
        price: number;
        mrp: number | null;
        image_url: string | null;
        unit: string | null;
        discount_percent?: number | null;
        default_variant?: ProductVariant | null;
        stock_quantity?: number;
    };
    onAddToCart: (productId: string) => void;
    compact?: boolean;
    cartQuantity?: number;
    onQuantityChange?: (productId: string, newQuantity: number) => void;
    /** Show seasonal badge from theme if available */
    showSeasonalBadge?: boolean;
}

export default function ProductCard({
    product,
    onAddToCart,
    compact = false,
    cartQuantity = 0,
    onQuantityChange,
    showSeasonalBadge = true,
}: ProductCardProps) {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [isAdding, setIsAdding] = useState(false);

    const variant = product.default_variant;
    const displayPrice = variant?.price ?? product.price;
    const displayMrp = variant?.mrp ?? product.mrp;

    // Calculate discount percentage
    const discountPercent = displayMrp && displayMrp > displayPrice
        ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
        : product.discount_percent || 0;

    // Stock status - use actual stock or default to high value
    const stockQty = product.stock_quantity ?? 999;
    const isLowStock = stockQty > 0 && stockQty <= 5;
    const isLimitedStock = stockQty > 5 && stockQty <= 10;
    const isOutOfStock = stockQty <= 0;

    // Display unit info
    const unitDisplay = variant
        ? formatVariantDisplay(variant)
        : product.unit;

    // Get seasonal promo badge from theme
    const promo = theme?.contentEmphasis?.promo;
    const seasonalBadge = showSeasonalBadge && promo?.badgeEnabled && promo?.badgeText
        ? { text: promo.badgeText, color: promo.badgeColor }
        : null;

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Check stock before adding
        if (isOutOfStock) {
            toast.error('This product is out of stock');
            return;
        }

        if (cartQuantity >= stockQty) {
            toast.error(`Only ${stockQty} available in stock`);
            return;
        }

        setIsAdding(true);
        onAddToCart(product.id);
        setTimeout(() => setIsAdding(false), 200);
    };

    const handleIncrement = () => {
        // Stock check is handled by QuantityControls component
        if (onQuantityChange) {
            onQuantityChange(product.id, cartQuantity + 1);
        } else {
            onAddToCart(product.id);
        }
    };

    const handleDecrement = () => {
        if (onQuantityChange && cartQuantity > 0) {
            onQuantityChange(product.id, cartQuantity - 1);
        }
    };

    return (
        <Card
            className={`overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0 bg-card w-full`}
            onClick={() => navigate(`/product/${product.id}`)}
        >
            {/* Image Container - Consistent height for all cards */}
            <div className={`relative bg-muted ${compact ? 'h-[100px]' : 'h-[130px]'}`}>
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                )}

                {/* Discount Badge - Top Left */}
                {discountPercent > 0 && (
                    <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] font-bold shadow-md">
                        {discountPercent}% OFF
                    </div>
                )}

                {/* Stock Badge - Top Right */}
                {(isLowStock || isLimitedStock) && (
                    <div className={`absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isLowStock ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white'
                        }`}>
                        {isLowStock ? `${stockQty} left!` : `${stockQty} left`}
                    </div>
                )}

                {/* Seasonal/Theme Badge - Bottom Left */}
                {seasonalBadge && !discountPercent && (
                    <div
                        className="absolute bottom-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-md text-white"
                        style={{ backgroundColor: seasonalBadge.color ? `hsl(${seasonalBadge.color})` : 'hsl(var(--primary))' }}
                    >
                        {seasonalBadge.text}
                    </div>
                )}

                {/* Cart Controls - Using unified QuantityControls */}
                {cartQuantity > 0 ? (
                    <div className="absolute bottom-2 right-2">
                        <QuantityControls
                            quantity={cartQuantity}
                            maxQuantity={stockQty}
                            onIncrement={handleIncrement}
                            onDecrement={handleDecrement}
                            variant="compact"
                            disabled={isOutOfStock}
                        />
                    </div>
                ) : (
                    <button
                        onClick={handleAdd}
                        disabled={isOutOfStock}
                        className={`absolute bottom-2 right-2 px-5 py-2 rounded-lg font-bold text-base
                            bg-primary text-white shadow-lg border border-primary
                            transition-all duration-150 ease-out
                            hover:bg-primary/90 hover:scale-105
                            active:scale-95
                            ${isAdding ? 'scale-90 bg-primary/80' : ''}
                            ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        ADD
                    </button>
                )}
            </div>

            {/* Content */}
            <CardContent className="p-2">
                {/* Price Row */}
                <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-bold text-primary text-sm">₹{displayPrice}</span>
                    {displayMrp && displayMrp > displayPrice && (
                        <span className="text-[10px] line-through text-muted-foreground">₹{displayMrp}</span>
                    )}
                </div>

                {/* Product Name */}
                <p className={`text-xs font-medium line-clamp-2 mt-1 ${compact ? 'line-clamp-1' : ''}`}>
                    {product.name}
                </p>

                {/* Unit Info */}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                    {unitDisplay}
                </p>
            </CardContent>
        </Card>
    );
}
