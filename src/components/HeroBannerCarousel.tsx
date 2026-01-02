import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeroBanner {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    background_type: 'gradient' | 'image' | 'color';
    background_value: string;
    image_url: string | null;
    image_position: string;
    text_color: string;
    text_align: string;
    button_text: string | null;
    button_link: string | null;
    button_bg_color: string;
    button_text_color: string;
    height: string;
    border_radius: string;
    click_type: string | null;
    click_target: string | null;
}

export default function HeroBannerCarousel() {
    const navigate = useNavigate();
    const [banners, setBanners] = useState<HeroBanner[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        try {
            const { data, error } = await supabase
                .from('hero_banners' as any)
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (data && !error) {
                setBanners(data as unknown as HeroBanner[]);
            }
        } catch (error) {
            console.log('Hero banners not available:', error);
        }
        setLoading(false);
    };

    const nextSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % Math.max(banners.length, 1));
    }, [banners.length]);

    const prevSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % Math.max(banners.length, 1));
    }, [banners.length]);

    // Auto-slide
    useEffect(() => {
        if (banners.length <= 1) return;
        const interval = setInterval(nextSlide, 5000);
        return () => clearInterval(interval);
    }, [banners.length, nextSlide]);

    if (loading || banners.length === 0) return null;

    const getBackgroundStyle = (banner: HeroBanner) => {
        switch (banner.background_type) {
            case 'gradient':
                return { background: banner.background_value };
            case 'image':
                return {
                    backgroundImage: `url(${banner.background_value})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                };
            case 'color':
                return { backgroundColor: banner.background_value };
            default:
                return { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };
        }
    };

    const handleButtonClick = (e: React.MouseEvent, link: string | null) => {
        e.stopPropagation();
        if (!link) return;

        if (link.startsWith('http')) {
            window.open(link, '_blank');
        } else {
            navigate(link);
        }
    };

    const handleBannerClick = (banner: HeroBanner) => {
        if (!banner.click_type || banner.click_type === 'none' || !banner.click_target) return;

        switch (banner.click_type) {
            case 'category':
                navigate(`/shop?category=${banner.click_target}`);
                break;
            case 'product':
                navigate(`/product/${banner.click_target}`);
                break;
            case 'url':
                if (banner.click_target.startsWith('http')) {
                    window.open(banner.click_target, '_blank');
                } else {
                    navigate(banner.click_target);
                }
                break;
        }
    };

    return (
        <div className="relative mx-4 my-4 overflow-hidden rounded-2xl">
            <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {banners.map((banner) => (
                    <div
                        key={banner.id}
                        className={`min-w-full relative ${banner.click_type && banner.click_type !== 'none' && banner.click_target
                                ? 'cursor-pointer'
                                : ''
                            }`}
                        style={{
                            ...getBackgroundStyle(banner),
                            minHeight: banner.height || '200px',
                            borderRadius: banner.border_radius || '16px',
                            color: banner.text_color || '#ffffff',
                        }}
                        onClick={() => handleBannerClick(banner)}
                    >
                        <div
                            className={`h-full flex flex-col justify-center p-6 ${banner.image_position === 'right' ? 'pr-24 md:pr-48' : ''
                                }`}
                            style={{ textAlign: banner.text_align as any }}
                        >
                            {/* Title */}
                            <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
                                {banner.title}
                            </h2>

                            {/* Subtitle */}
                            {banner.subtitle && (
                                <p className="text-base md:text-lg opacity-90 mb-2">
                                    {banner.subtitle}
                                </p>
                            )}

                            {/* Description */}
                            {banner.description && (
                                <p className="text-sm opacity-80 mb-4">
                                    {banner.description}
                                </p>
                            )}

                            {/* Button */}
                            {banner.button_text && (
                                <div>
                                    <Button
                                        onClick={(e) => handleButtonClick(e, banner.button_link)}
                                        style={{
                                            backgroundColor: banner.button_bg_color,
                                            color: banner.button_text_color,
                                        }}
                                        className="px-6 py-2 rounded-full font-semibold shadow-lg hover:opacity-90 transition-opacity"
                                    >
                                        {banner.button_text}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Optional Image Overlay */}
                        {banner.image_url && banner.image_position !== 'background' && (
                            <img
                                src={banner.image_url}
                                alt=""
                                className={`absolute ${banner.image_position === 'right'
                                    ? 'right-2 top-1/2 -translate-y-1/2 h-4/5 max-w-[40%]'
                                    : banner.image_position === 'left'
                                        ? 'left-2 top-1/2 -translate-y-1/2 h-4/5 max-w-[40%]'
                                        : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4/5'
                                    } object-contain`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Navigation Arrows */}
            {banners.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5 text-gray-700" />
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md transition-colors"
                    >
                        <ChevronRight className="h-5 w-5 text-gray-700" />
                    </button>
                </>
            )}

            {/* Dots Indicator */}
            {banners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                    {banners.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-2 rounded-full transition-all ${idx === currentIndex
                                ? 'w-6 bg-white'
                                : 'w-2 bg-white/50 hover:bg-white/70'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
