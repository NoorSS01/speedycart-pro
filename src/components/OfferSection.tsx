import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { logger } from '@/lib/logger';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';

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
    filter_config: FilterConfig;
    max_products: number;
    show_see_all: boolean;
    see_all_link: string | null;
}

interface FilterConfig {
    min_discount?: number;
    max_discount?: number;
    category_ids?: string[];
    product_ids?: string[];
    [key: string]: unknown;
}
interface Product {
    id: string;
    name: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    unit: string | null;
    discount_percent: number | null;
    category_id: string | null;
    default_variant?: {
        price: number;
        mrp: number | null;
        variant_name: string;
        variant_value: number;
        variant_unit: string | null;
    } | null;
}

interface OfferSectionProps {
    section: OfferSection;
    onAddToCart: (productId: string) => void;
}

export default function OfferSectionComponent({ section, onAddToCart }: OfferSectionProps) {
    const navigate = useNavigate();
    const { getItemQuantity, updateQuantity } = useCart();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProducts = useCallback(async () => {
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
                case 'discount': {
                    const minDiscount = section.filter_config?.min_discount || 0;
                    const maxDiscount = section.filter_config?.max_discount || 100;
                    query = query.gte('discount_percent', minDiscount).lte('discount_percent', maxDiscount);
                    break;
                }
                case 'category': {
                    const categoryIds = section.filter_config?.category_ids || [];
                    if (categoryIds.length > 0) {
                        query = query.in('category_id', categoryIds);
                    }
                    break;
                }
                case 'manual': {
                    const productIds = section.filter_config?.product_ids || [];
                    if (productIds.length > 0) {
                        query = query.in('id', productIds);
                    }
                    break;
                }
            }

            query = query.limit(section.max_products).order('discount_percent', { ascending: false });

            const { data } = await query;

            if (data) {
                const processed = data.map(p => ({
                    ...p,
                    default_variant: p.product_variants?.find(v => v.is_default) || p.product_variants?.[0] || null
                }));
                setProducts(processed as unknown as Product[]);
            }
        } catch (error) {
            logger.error('Error fetching offer products', { error });
        }
        setLoading(false);
    }, [section]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

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
                    {products.map((product) => (
                        <div key={product.id} className="flex-shrink-0 w-[150px]">
                            <ProductCard
                                product={product}
                                onAddToCart={onAddToCart}
                                cartQuantity={getItemQuantity(product.id, null)}
                                onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                            />
                        </div>
                    ))}
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
