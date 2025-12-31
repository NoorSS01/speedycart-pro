import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Plus, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVariantDisplay } from '@/lib/formatUnit';

interface OfferSection {
    id: string;
    name: string;
    title: string;
    subtitle: string | null;
    background_type: string;
    background_value: string;
    text_color: string;
    image_url: string | null;
    filter_type: string;
    filter_config: Record<string, any>;
    max_products: number;
    show_see_all: boolean;
    see_all_link: string | null;
}

interface Product {
    id: string;
    name: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    unit: string;
    discount_percent: number | null;
    category_id: string | null;
    default_variant?: {
        price: number;
        mrp: number | null;
        variant_name: string;
        variant_value: number;
        variant_unit: string;
    } | null;
}

interface OfferSectionProps {
    section: OfferSection;
    onAddToCart: (productId: string) => void;
}

export default function OfferSectionComponent({ section, onAddToCart }: OfferSectionProps) {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, [section]);

    const fetchProducts = async () => {
        try {
            let query = supabase
                .from('products')
                .select(`
                    id, name, price, mrp, image_url, unit, discount_percent, category_id,
                    product_variants!left(price, mrp, variant_name, variant_value, variant_unit, is_default)
                `)
                .eq('is_active', true);

            // Apply filter based on type
            switch (section.filter_type) {
                case 'discount':
                    const minDiscount = section.filter_config?.min_discount || 0;
                    const maxDiscount = section.filter_config?.max_discount || 100;
                    query = query.gte('discount_percent', minDiscount).lte('discount_percent', maxDiscount);
                    break;
                case 'category':
                    const categoryIds = section.filter_config?.category_ids || [];
                    if (categoryIds.length > 0) {
                        query = query.in('category_id', categoryIds);
                    }
                    break;
                case 'manual':
                    const productIds = section.filter_config?.product_ids || [];
                    if (productIds.length > 0) {
                        query = query.in('id', productIds);
                    }
                    break;
            }

            query = query.limit(section.max_products).order('discount_percent', { ascending: false });

            const { data } = await query;

            if (data) {
                const processed = data.map((p: any) => ({
                    ...p,
                    default_variant: p.product_variants?.find((v: any) => v.is_default) || p.product_variants?.[0] || null
                }));
                setProducts(processed);
            }
        } catch (error) {
            console.error('Error fetching offer products:', error);
        }
        setLoading(false);
    };

    const getBackgroundStyle = () => {
        switch (section.background_type) {
            case 'gradient':
                return { background: section.background_value };
            case 'image':
                return {
                    backgroundImage: `url(${section.background_value})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                };
            default:
                return { backgroundColor: section.background_value };
        }
    };

    const handleSeeAll = () => {
        if (section.see_all_link) {
            navigate(section.see_all_link);
        } else {
            // Navigate to shop with filter
            navigate(`/shop?offer=${section.id}`);
        }
    };

    if (loading || products.length === 0) return null;

    return (
        <div className="mb-6">
            {/* Banner Header */}
            <div
                className="mx-4 rounded-t-2xl p-4 relative overflow-hidden"
                style={{ ...getBackgroundStyle(), color: section.text_color }}
            >
                <h2 className="text-xl font-bold">{section.title}</h2>
                {section.subtitle && (
                    <p className="text-sm opacity-90">{section.subtitle}</p>
                )}
                {section.image_url && (
                    <img
                        src={section.image_url}
                        alt=""
                        className="absolute right-2 bottom-0 h-20 object-contain"
                    />
                )}
            </div>

            {/* Products Carousel */}
            <div className="bg-background mx-4 rounded-b-2xl border border-t-0 p-3">
                <div
                    className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {products.map((product) => {
                        const variant = product.default_variant;
                        const displayPrice = variant?.price ?? product.price;
                        const displayMrp = variant?.mrp ?? product.mrp;
                        const discount = displayMrp && displayMrp > displayPrice
                            ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
                            : product.discount_percent || 0;

                        return (
                            <Card
                                key={product.id}
                                className="min-w-[130px] max-w-[130px] overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0"
                                onClick={() => navigate(`/product/${product.id}`)}
                            >
                                <div className="relative aspect-square bg-muted">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    )}
                                    {/* Add Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddToCart(product.id);
                                        }}
                                        className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                                <CardContent className="p-2">
                                    {/* Price */}
                                    <div className="flex items-center gap-1 mb-1">
                                        <span className="font-bold text-primary text-sm">₹{displayPrice}</span>
                                        {displayMrp && displayMrp > displayPrice && (
                                            <span className="text-[10px] line-through text-muted-foreground">₹{displayMrp}</span>
                                        )}
                                    </div>
                                    {/* Discount Badge */}
                                    {discount > 0 && (
                                        <span className="text-[10px] text-green-600 font-semibold">
                                            ₹{(displayMrp || 0) - displayPrice} OFF
                                        </span>
                                    )}
                                    {/* Name */}
                                    <p className="text-xs font-medium line-clamp-2 mt-1">{product.name}</p>
                                    {/* Unit */}
                                    <p className="text-[10px] text-muted-foreground">
                                        {variant ? formatVariantDisplay(variant) : product.unit}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* See All */}
                {section.show_see_all && (
                    <button
                        onClick={handleSeeAll}
                        className="w-full text-center text-primary font-semibold text-sm py-2 mt-2 flex items-center justify-center gap-1 hover:underline"
                    >
                        See all <ChevronRight className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
