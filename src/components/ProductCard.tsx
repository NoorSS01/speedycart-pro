import { useState, useMemo, useCallback, memo } from 'react';
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
    cartQuantity?: number;
    onQuantityChange?: (productId: string, newQuantity: number) => void;
    /** Show seasonal badge from theme if available */
    showSeasonalBadge?: boolean;
}

const ProductCard = memo(function ProductCard({
    product,
    onAddToCart,
    cartQuantity = 0,
    onQuantityChange,
    showSeasonalBadge = true,
}: ProductCardProps) {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [isAdding, setIsAdding] = useState(false);

    // Memoize computed values to avoid recalculation on every render
    const { variant, displayPrice, displayMrp, discountPercent, stockQty, isLowStock, isLimitedStock, isOutOfStock, unitDisplay } = useMemo(() => {
        const v = product.default_variant;
        const price = v?.price ?? product.price;
        const mrp = v?.mrp ?? product.mrp;
        const discount = mrp && mrp > price
            ? Math.round(((mrp - price) / mrp) * 100)
            : product.discount_percent || 0;
        const stock = product.stock_quantity ?? 999;
        return {
            variant: v,
            displayPrice: price,
            displayMrp: mrp,
            discountPercent: discount,
            stockQty: stock,
            isLowStock: stock > 0 && stock <= 5,
            isLimitedStock: stock > 5 && stock <= 10,
            isOutOfStock: stock <= 0,
            unitDisplay: v ? formatVariantDisplay(v) : (product.unit ? `1 ${product.unit}` : null),
        };
    }, [product]);

    // Memoize seasonal badge
    const seasonalBadge = useMemo(() => {
        const promo = theme?.contentEmphasis?.promo;
        return showSeasonalBadge && promo?.badgeEnabled && promo?.badgeText
            ? { text: promo.badgeText, color: promo.badgeColor }
            : null;
    }, [theme?.contentEmphasis?.promo, showSeasonalBadge]);

    // Memoize event handlers
    const handleAdd = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

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
    }, [isOutOfStock, cartQuantity, stockQty, onAddToCart, product.id]);

    const handleIncrement = useCallback(() => {
        if (onQuantityChange) {
            onQuantityChange(product.id, cartQuantity + 1);
        } else {
            onAddToCart(product.id);
        }
    }, [onQuantityChange, onAddToCart, product.id, cartQuantity]);

    const handleDecrement = useCallback(() => {
        if (onQuantityChange && cartQuantity > 0) {
            onQuantityChange(product.id, cartQuantity - 1);
        }
    }, [onQuantityChange, product.id, cartQuantity]);

    return (
        <Card
            className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0 bg-card w-full h-[210px] flex flex-col"
            onClick={() => navigate(`/product/${product.id}`)}
        >
            {/* Image Container - Fixed height */}
            <div className="relative bg-muted h-[130px] flex-shrink-0">
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

            {/* Content - Fixed height section */}
            <CardContent className="p-2 h-[80px] flex flex-col justify-between overflow-hidden">
                {/* Price Row - Fixed single line */}
                <div className="flex items-baseline gap-1.5 flex-nowrap overflow-hidden">
                    <span className="font-bold text-primary text-sm flex-shrink-0">₹{displayPrice}</span>
                    {displayMrp && displayMrp > displayPrice && (
                        <span className="text-[10px] line-through text-muted-foreground truncate">₹{displayMrp}</span>
                    )}
                </div>

                {/* Product Name - Fixed 2-line height with min-h to always reserve space */}
                <p className="text-xs font-medium line-clamp-2 min-h-[2rem] leading-4">
                    {product.name}
                </p>

                {/* Unit Info - Single line */}
                <p className="text-[10px] text-muted-foreground truncate">
                    {unitDisplay || '\u00A0'}
                </p>
            </CardContent>
        </Card>
    );
});

export default ProductCard;
