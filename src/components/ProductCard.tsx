import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVariantDisplay } from '@/lib/formatUnit';

interface ProductVariant {
    price: number;
    mrp: number | null;
    variant_name: string;
    variant_value: number;
    variant_unit: string;
}

interface ProductCardProps {
    product: {
        id: string;
        name: string;
        price: number;
        mrp: number | null;
        image_url: string | null;
        unit: string;
        discount_percent?: number | null;
        default_variant?: ProductVariant | null;
    };
    onAddToCart: (productId: string) => void;
    compact?: boolean;
}

export default function ProductCard({ product, onAddToCart, compact = false }: ProductCardProps) {
    const navigate = useNavigate();
    const [isAdding, setIsAdding] = useState(false);

    const variant = product.default_variant;
    const displayPrice = variant?.price ?? product.price;
    const displayMrp = variant?.mrp ?? product.mrp;
    const discount = displayMrp && displayMrp > displayPrice
        ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
        : product.discount_percent || 0;
    const discountAmount = displayMrp && displayMrp > displayPrice
        ? displayMrp - displayPrice
        : 0;

    // Display unit info
    const unitDisplay = variant
        ? formatVariantDisplay(variant)
        : product.unit;

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAdding(true);
        onAddToCart(product.id);

        // Reset animation after 200ms
        setTimeout(() => setIsAdding(false), 200);
    };

    return (
        <Card
            className={`overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0 bg-card ${compact ? 'min-w-[120px] max-w-[120px]' : 'min-w-[140px] max-w-[140px]'
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

                {/* ADD Button - Pill style on image bottom-right */}
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

                {/* Discount Badge */}
                {discountAmount > 0 && (
                    <div className="text-[10px] text-green-600 font-semibold mt-0.5">
                        ₹{discountAmount} OFF
                    </div>
                )}

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
