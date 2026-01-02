import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Palette, Snowflake, Sun, CloudRain, Flower2, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import AdminBottomNav from '@/components/AdminBottomNav';

interface Theme {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_gradient: string | null;
    animation_type: string | null;
    animation_intensity: string;
    promo_badge_text: string | null;
    promo_badge_color: string | null;
}

export default function AdminThemes() {
    const { user, userRole, loading: authLoading } = useAuth();
    const { refreshTheme } = useThemeContext();
    const navigate = useNavigate();
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState<string | null>(null);

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    useEffect(() => {
        if (authLoading) return;
        if (!user || !isAdmin) {
            navigate('/');
            return;
        }
        fetchThemes();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchThemes = async () => {
        try {
            const { data } = await (supabase as any)
                .from('themes')
                .select('*')
                .order('type', { ascending: true })
                .order('name', { ascending: true });

            if (data) setThemes(data);
        } catch (error) {
            console.error('Error fetching themes:', error);
        }
        setLoading(false);
    };

    const toggleTheme = async (themeId: string, activate: boolean) => {
        setActivating(themeId);
        try {
            if (activate) {
                // First deactivate all themes
                await (supabase as any)
                    .from('themes')
                    .update({ is_active: false })
                    .neq('id', themeId);

                // Then activate selected theme
                await (supabase as any)
                    .from('themes')
                    .update({ is_active: true })
                    .eq('id', themeId);

                toast.success('Theme activated');
            } else {
                // Deactivate theme
                await (supabase as any)
                    .from('themes')
                    .update({ is_active: false })
                    .eq('id', themeId);

                toast.success('Theme deactivated');
            }

            await fetchThemes();
            await refreshTheme();
        } catch (error) {
            toast.error('Failed to update theme');
        }
        setActivating(null);
    };

    const getThemeIcon = (animationType: string | null) => {
        switch (animationType) {
            case 'snowfall': return <Snowflake className="h-5 w-5" />;
            case 'sparkles': return <Sun className="h-5 w-5" />;
            case 'rain': return <CloudRain className="h-5 w-5" />;
            case 'petals': return <Flower2 className="h-5 w-5" />;
            case 'leaves': return <Sparkles className="h-5 w-5" />;
            case 'confetti': return <Sparkles className="h-5 w-5" />;
            default: return <Palette className="h-5 w-5" />;
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'seasonal':
                return <Badge variant="secondary">Seasonal</Badge>;
            case 'festival':
                return <Badge className="bg-amber-500">Festival</Badge>;
            case 'custom':
                return <Badge variant="outline">Custom</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pb-20">
                <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-6 w-40" />
                    </div>
                </header>
                <div className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
            </div>
        );
    }

    const activeTheme = themes.find(t => t.is_active);
    const inactiveThemes = themes.filter(t => !t.is_active);

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold">Theme Manager</h1>
                        <p className="text-xs text-muted-foreground">Professional seasonal themes</p>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* Active Theme */}
                {activeTheme && (
                    <div>
                        <h2 className="font-semibold mb-3 flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            Currently Active
                        </h2>
                        <Card className="border-green-500 border-2">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                                            style={{ backgroundColor: activeTheme.primary_color }}
                                        >
                                            {getThemeIcon(activeTheme.animation_type)}
                                        </div>
                                        <div>
                                            <p className="font-semibold">{activeTheme.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getTypeBadge(activeTheme.type)}
                                                {activeTheme.animation_type && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {activeTheme.animation_type} animation
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={true}
                                        disabled={activating === activeTheme.id}
                                        onCheckedChange={() => toggleTheme(activeTheme.id, false)}
                                    />
                                </div>
                                {activeTheme.promo_badge_text && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Promo badge:</span>
                                        <span
                                            className="text-xs px-2 py-1 rounded-full text-white font-medium"
                                            style={{ backgroundColor: activeTheme.promo_badge_color || activeTheme.primary_color }}
                                        >
                                            {activeTheme.promo_badge_text}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* No Active Theme */}
                {!activeTheme && (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                            <Palette className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No theme currently active</p>
                            <p className="text-xs text-muted-foreground mt-1">Activate a theme below to give your store a seasonal look</p>
                        </CardContent>
                    </Card>
                )}

                {/* Available Themes */}
                <div>
                    <h2 className="font-semibold mb-3 text-sm text-muted-foreground">
                        Available Themes ({inactiveThemes.length})
                    </h2>
                    <div className="space-y-3">
                        {inactiveThemes.map(theme => (
                            <Card key={theme.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow"
                                                style={{ backgroundColor: theme.primary_color }}
                                            >
                                                {getThemeIcon(theme.animation_type)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{theme.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {getTypeBadge(theme.type)}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={activating === theme.id}
                                            onClick={() => toggleTheme(theme.id, true)}
                                        >
                                            {activating === theme.id ? 'Activating...' : 'Activate'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Color Palette Preview */}
                {themes.length > 0 && (
                    <div>
                        <h2 className="font-semibold mb-3 text-sm text-muted-foreground">Color Palettes</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {themes.slice(0, 4).map(theme => (
                                <Card key={theme.id} className="overflow-hidden">
                                    <div className="h-4 flex">
                                        <div className="flex-1" style={{ backgroundColor: theme.primary_color }} />
                                        <div className="flex-1" style={{ backgroundColor: theme.secondary_color }} />
                                        <div className="flex-1" style={{ backgroundColor: theme.accent_color }} />
                                    </div>
                                    <CardContent className="p-2">
                                        <p className="text-xs font-medium truncate">{theme.name}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <AdminBottomNav />
        </div>
    );
}
