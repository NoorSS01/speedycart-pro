import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface Theme {
    id: string;
    name: string;
    type: 'seasonal' | 'festival' | 'custom';
    is_active: boolean;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_gradient: string | null;
    animation_type: 'none' | 'snowfall' | 'leaves' | 'rain' | 'confetti' | 'sparkles' | 'petals' | null;
    animation_intensity: 'low' | 'medium' | 'high';
    header_banner_url: string | null;
    logo_overlay_url: string | null;
    corner_decoration_url: string | null;
    promo_badge_text: string | null;
    promo_badge_color: string | null;
    glassmorphism_enabled: boolean;
    custom_font: string | null;
}

interface ThemeContextType {
    activeTheme: Theme | null;
    isLoading: boolean;
    refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [activeTheme, setActiveTheme] = useState<Theme | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchActiveTheme = async () => {
        try {
            const now = new Date().toISOString();

            const { data } = await supabase
                .from('themes')
                .select('*')
                .eq('is_active', true)
                .or(`starts_at.is.null,starts_at.lte.${now}`)
                .or(`ends_at.is.null,ends_at.gte.${now}`)
                .maybeSingle();

            if (data) {
                setActiveTheme(data);
                applyThemeColors(data);
            } else {
                setActiveTheme(null);
                resetThemeColors();
            }
        } catch (error) {
            logger.debug('Theme not available');
        }
        setIsLoading(false);
    };

    const applyThemeColors = (theme: Theme) => {
        const root = document.documentElement;

        // Store original colors before theme override
        if (theme.primary_color) {
            root.style.setProperty('--theme-primary', theme.primary_color);
        }
        if (theme.secondary_color) {
            root.style.setProperty('--theme-secondary', theme.secondary_color);
        }
        if (theme.accent_color) {
            root.style.setProperty('--theme-accent', theme.accent_color);
        }
        if (theme.background_gradient) {
            root.style.setProperty('--theme-gradient', theme.background_gradient);
        }
        if (theme.custom_font) {
            root.style.setProperty('--theme-font', theme.custom_font);
        }
    };

    const resetThemeColors = () => {
        const root = document.documentElement;
        root.style.removeProperty('--theme-primary');
        root.style.removeProperty('--theme-secondary');
        root.style.removeProperty('--theme-accent');
        root.style.removeProperty('--theme-gradient');
        root.style.removeProperty('--theme-font');
    };

    useEffect(() => {
        fetchActiveTheme();
    }, []);

    const refreshTheme = async () => {
        await fetchActiveTheme();
    };

    return (
        <ThemeContext.Provider value={{ activeTheme, isLoading, refreshTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeContext() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext must be used within a ThemeProvider');
    }
    return context;
}
