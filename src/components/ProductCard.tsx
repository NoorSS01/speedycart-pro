import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Minus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVariantDisplay } from '@/lib/formatUnit';

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
}

export default function ProductCard({
    product,
    onAddToCart,
    compact = false,
    cartQuantity = 0,
    onQuantityChange,
}: ProductCardProps) {
    const navigate = useNavigate();
    const [isAdding, setIsAdding] = useState(false);

    const variant = product.default_variant;
    const displayPrice = variant?.price ?? product.price;
    const displayMrp = variant?.mrp ?? product.mrp;

    // Calculate discount percentage
    const discountPercent = displayMrp && displayMrp > displayPrice
        ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
        : product.discount_percent || 0;

    // Stock status
    const stockQty = product.stock_quantity ?? 999;
    const isLowStock = stockQty > 0 && stockQty <= 5;
    const isLimitedStock = stockQty > 5 && stockQty <= 10;

    // Display unit info
    const unitDisplay = variant
        ? formatVariantDisplay(variant)
        : product.unit;

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAdding(true);
        onAddToCart(product.id);
        setTimeout(() => setIsAdding(false), 200);
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onQuantityChange && cartQuantity > 0) {
            onQuantityChange(product.id, cartQuantity - 1);
        }
    };

    const handleIncrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onQuantityChange) {
            onQuantityChange(product.id, cartQuantity + 1);
        } else {
            onAddToCart(product.id);
        }
    };

    return (
        <Card
            className={`overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0 bg-card w-full ${compact ? 'min-w-[120px] max-w-[140px]' : 'min-w-[140px] max-w-[160px]'
                }`}
            onClick={() => navigate(`/product/${product.id}`)}
        >
            {/* Image Container */}
            <div className={`relative bg-muted ${compact ? 'h-24' : 'aspect-square'}`}>
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

                {/* Cart Controls */}
                {cartQuantity > 0 ? (
                    <div
                        className="absolute bottom-2 right-2 flex items-center gap-0 rounded-lg overflow-hidden shadow-lg bg-primary"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={handleDecrement}
                            className="p-1.5 text-white hover:bg-primary/80 transition-colors"
                            aria-label="Decrease quantity"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <span className="px-2 text-white font-bold text-sm min-w-[24px] text-center">
                            {cartQuantity}
                        </span>
                        <button
                            onClick={handleIncrement}
                            className="p-1.5 text-white hover:bg-primary/80 transition-colors"
                            aria-label="Increase quantity"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleAdd}
                        className={`absolute bottom-2 right-2 px-4 py-1.5 rounded-lg font-bold text-sm
                            bg-primary text-white shadow-lg border border-primary
                            transition-all duration-150 ease-out
                            hover:bg-primary/90 hover:scale-105
                            active:scale-95
                            ${isAdding ? 'scale-90 bg-primary/80' : ''}
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
