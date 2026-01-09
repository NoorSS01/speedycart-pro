import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Banner {
    id: string;
    title: string;
    subtitle: string | null;
    image_url: string | null;
    link_url: string | null;
    background_color: string;
    text_color: string;
}

export default function PromotionalBanners() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const fetchBanners = async () => {
        try {
            const { data, error } = await supabase
                .from('promotional_banners')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (data && !error) {
                setBanners(data as unknown as Banner[]);
            }
        } catch (error) {
            // Table might not exist yet - silently fail
            logger.debug('Promotional banners not available', { error });
        }
    };

    const nextSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % Math.max(banners.length, 1));
    }, [banners.length]);

    const prevSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % Math.max(banners.length, 1));
    }, [banners.length]);

    // HOOKS MUST ALL BE CALLED BEFORE ANY EARLY RETURNS!
    useEffect(() => {
        fetchBanners();
    }, []);

    // Auto-slide every 5 seconds
    useEffect(() => {
        if (banners.length <= 1) return;
        const interval = setInterval(nextSlide, 5000);
        return () => clearInterval(interval);
    }, [banners.length, nextSlide]);

    // NOW we can do early return - after all hooks
    if (banners.length === 0) return null;

    return (
        <div className="relative overflow-hidden rounded-xl mx-4 my-4">
            <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {banners.map((banner) => (
                    <div
                        key={banner.id}
                        className="min-w-full px-1"
                    >
                        <div
                            className="rounded-xl p-4 min-h-[80px] flex flex-col justify-center"
                            style={{
                                backgroundColor: banner.background_color,
                                color: banner.text_color
                            }}
                        >
                            <h3 className="font-bold text-lg">{banner.title}</h3>
                            {banner.subtitle && (
                                <p className="text-sm opacity-90">{banner.subtitle}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Arrows */}
            {banners.length > 1 && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 hover:bg-white"
                        onClick={prevSlide}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 hover:bg-white"
                        onClick={nextSlide}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </>
            )}

            {/* Dots Indicator */}
            {banners.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {banners.map((_, idx) => (
                        <button
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                                }`}
                            onClick={() => setCurrentIndex(idx)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
