import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Palette, Snowflake, Sun, CloudRain, Flower2, Sparkles, Check, Plus, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newTheme, setNewTheme] = useState<Partial<Theme>>({
        name: '',
        type: 'custom',
        is_active: false,
        primary_color: '#3b82f6',
        secondary_color: '#1e40af',
        accent_color: '#60a5fa',
        background_gradient: null,
        animation_type: null,
        animation_intensity: 'medium',
        promo_badge_text: null,
        promo_badge_color: null
    });

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    useEffect(() => {
        if (authLoading) return;
        if (!user || !isAdmin) {
            navigate('/');
            return;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fetchThemes();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchThemes = async () => {
        try {
            const { data } = await supabase
                .from('themes')
                .select('*')
                .order('type', { ascending: true })
                .order('name', { ascending: true });

            if (data) {
                const typedThemes: Theme[] = data.map((t: any) => ({
                    ...t,
                    type: t.type || 'seasonal',
                    animation_intensity: t.animation_intensity || 'medium',
                    primary_color: t.primary_color || '#000000',
                    secondary_color: t.secondary_color || '#000000',
                    accent_color: t.accent_color || '#000000',
                    is_active: t.is_active ?? false
                }));
                setThemes(typedThemes);
            }
        } catch (error) {
            logger.error('Failed to fetch themes', { error });
        }
        setLoading(false);
    };

    const openCreateDialog = () => {
        setNewTheme({
            name: '',
            type: 'custom',
            is_active: false,
            primary_color: '#3b82f6',
            secondary_color: '#1e40af',
            accent_color: '#60a5fa',
            background_gradient: null,
            animation_type: null,
            animation_intensity: 'medium',
            promo_badge_text: null,
            promo_badge_color: null
        });
        setShowCreateDialog(true);
    };

    const handleCreateTheme = async () => {
        if (!newTheme.name) {
            toast.error('Theme name is required');
            return;
        }

        try {
            setLoading(true);

            // Construct a complete object for insertion
            const themeToInsert = {
                name: newTheme.name,
                type: 'custom',
                is_active: false,
                primary_color: newTheme.primary_color || '#000000',
                secondary_color: newTheme.secondary_color || '#000000',
                accent_color: newTheme.accent_color || '#000000',
                background_gradient: newTheme.background_gradient,
                animation_type: newTheme.animation_type,
                animation_intensity: newTheme.animation_intensity || 'medium',
                promo_badge_text: newTheme.promo_badge_text,
                promo_badge_color: newTheme.promo_badge_color
            };

            const { error } = await supabase.from('themes').insert([themeToInsert]);

            if (error) throw error;

            toast.success('Theme created successfully');
            setShowCreateDialog(false);
            fetchThemes();
        } catch (error) {
            logger.error('Failed to create theme', { error });
            toast.error('Failed to create theme');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTheme = async (id: string) => {
        if (!confirm('Are you sure you want to delete this theme?')) return;

        try {
            const { error } = await supabase.from('themes').delete().eq('id', id);

            if (error) throw error;

            toast.success('Theme deleted');
            fetchThemes();
        } catch (error) {
            toast.error('Failed to delete theme');
        }
    };

    const toggleTheme = async (themeId: string, activate: boolean) => {
        setActivating(themeId);
        try {
            if (activate) {
                // First deactivate all themes
                await supabase
                    .from('themes')
                    .update({ is_active: false })
                    .neq('id', themeId);

                // Then activate selected theme
                await supabase
                    .from('themes')
                    .update({ is_active: true })
                    .eq('id', themeId);

                toast.success('Theme activated');
            } else {
                // Deactivate theme
                await supabase
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

                {/* Create Custom Theme Action */}
                <div className="flex justify-end">
                    <Button onClick={() => openCreateDialog()}>
                        <Plus className="h-4 w-4 mr-2" /> Create Custom Theme
                    </Button>
                </div>

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
                                        <div className="flex gap-2">
                                            {theme.type === 'custom' && (
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteTheme(theme.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={activating === theme.id}
                                                onClick={() => toggleTheme(theme.id, true)}
                                            >
                                                {activating === theme.id ? 'Activating...' : 'Activate'}
                                            </Button>
                                        </div>
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

            {/* Create Theme Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Custom Theme</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Theme Name</Label>
                            <Input value={newTheme.name} onChange={(e) => setNewTheme(t => ({ ...t, name: e.target.value }))} placeholder="My Awesome Theme" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Primary Color</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={newTheme.primary_color} onChange={(e) => setNewTheme(t => ({ ...t, primary_color: e.target.value }))} className="h-10 w-14 p-1 rounded cursor-pointer" />
                                    <Input value={newTheme.primary_color} onChange={(e) => setNewTheme(t => ({ ...t, primary_color: e.target.value }))} className="uppercase" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Secondary Color</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={newTheme.secondary_color} onChange={(e) => setNewTheme(t => ({ ...t, secondary_color: e.target.value }))} className="h-10 w-14 p-1 rounded cursor-pointer" />
                                    <Input value={newTheme.secondary_color} onChange={(e) => setNewTheme(t => ({ ...t, secondary_color: e.target.value }))} className="uppercase" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Accent Color</Label>
                            <div className="flex gap-2">
                                <input type="color" value={newTheme.accent_color} onChange={(e) => setNewTheme(t => ({ ...t, accent_color: e.target.value }))} className="h-10 w-14 p-1 rounded cursor-pointer" />
                                <Input value={newTheme.accent_color} onChange={(e) => setNewTheme(t => ({ ...t, accent_color: e.target.value }))} className="uppercase" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Animation Effect</Label>
                            <Select value={newTheme.animation_type || 'none'} onValueChange={(v) => setNewTheme(t => ({ ...t, animation_type: v === 'none' ? null : v }))}>
                                <SelectTrigger><SelectValue placeholder="Select Effect" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="snowfall">Snowfall (Winter)</SelectItem>
                                    <SelectItem value="rain">Rain (Monsoon)</SelectItem>
                                    <SelectItem value="testals">Falling Petals (Spring)</SelectItem>
                                    <SelectItem value="leaves">Falling Leaves (Autumn)</SelectItem>
                                    <SelectItem value="sparkles">Sparkles (Festive)</SelectItem>
                                    <SelectItem value="confetti">Confetti (Celebration)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Promo Badge Text</Label>
                                <Input value={newTheme.promo_badge_text || ''} onChange={(e) => setNewTheme(t => ({ ...t, promo_badge_text: e.target.value || null }))} placeholder="SALE" />
                            </div>
                            <div className="space-y-2">
                                <Label>Badge Color</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={newTheme.promo_badge_color || '#000000'} onChange={(e) => setNewTheme(t => ({ ...t, promo_badge_color: e.target.value }))} className="h-10 w-14 p-1 rounded cursor-pointer" />
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                            <Label className="mb-2 block">Theme Preview</Label>
                            <div className="w-full h-32 rounded-lg relative overflow-hidden flex items-center justify-center text-white font-bold text-xl shadow-lg border-2 border-white/20"
                                style={{
                                    backgroundColor: newTheme.primary_color,
                                    backgroundImage: newTheme.background_gradient || 'none'
                                }}>
                                <div className="absolute top-2 right-2">
                                    {newTheme.promo_badge_text && (
                                        <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: newTheme.promo_badge_color || '#000000' }}>
                                            {newTheme.promo_badge_text}
                                        </span>
                                    )}
                                </div>
                                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: newTheme.secondary_color }}>
                                    Icon
                                </div>
                                <div className="absolute bottom-0 w-full h-1/3" style={{ backgroundColor: newTheme.accent_color }}></div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreateTheme} disabled={loading}>{loading ? 'Creating...' : 'Create Theme'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminBottomNav />
        </div>
    );
}
