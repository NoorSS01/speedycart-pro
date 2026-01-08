import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, GripVertical, Eye, EyeOff, Save, ChevronUp, ChevronDown, LayoutGrid, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface Category {
    id: string;
    name: string;
    image_url: string | null;
    display_order: number;
    is_active: boolean;
    shop_section_visible: boolean;
}

export default function AdminCategorySections() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            toast.error('Failed to load categories');
            console.error('Error:', error);
        } else if (data) {
            // Default shop_section_visible to true if not set
            const mapped = data.map((cat: any) => ({
                ...cat,
                shop_section_visible: cat.shop_section_visible ?? true
            }));
            setCategories(mapped);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const toggleVisibility = (categoryId: string) => {
        setCategories(prev => prev.map(cat =>
            cat.id === categoryId
                ? { ...cat, shop_section_visible: !cat.shop_section_visible }
                : cat
        ));
        setHasChanges(true);
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        const newCategories = [...categories];
        [newCategories[index - 1], newCategories[index]] = [newCategories[index], newCategories[index - 1]];
        // Update display_order
        newCategories.forEach((cat, i) => cat.display_order = i + 1);
        setCategories(newCategories);
        setHasChanges(true);
    };

    const moveDown = (index: number) => {
        if (index === categories.length - 1) return;
        const newCategories = [...categories];
        [newCategories[index], newCategories[index + 1]] = [newCategories[index + 1], newCategories[index]];
        // Update display_order
        newCategories.forEach((cat, i) => cat.display_order = i + 1);
        setCategories(newCategories);
        setHasChanges(true);
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            // Update each category
            const updates = categories.map((cat, index) =>
                supabase
                    .from('categories')
                    .update({
                        display_order: index + 1,
                        shop_section_visible: cat.shop_section_visible
                    })
                    .eq('id', cat.id)
            );

            await Promise.all(updates);
            toast.success('Category sections updated successfully!');
            setHasChanges(false);
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Failed to save changes');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold">Shop Category Sections</h1>
                            <p className="text-xs text-muted-foreground">Manage visibility and order</p>
                        </div>
                    </div>
                    <Button
                        onClick={saveChanges}
                        disabled={!hasChanges || saving}
                        size="sm"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save
                    </Button>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 max-w-2xl">
                {/* Instructions */}
                <Card className="mb-6 border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                        <div className="flex gap-3">
                            <LayoutGrid className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">Category Sections in Shop Page</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Toggle which categories appear as horizontal sections on the shop page.
                                    Use the arrows to change the order. Categories appear in the order shown below.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Category List */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Categories</CardTitle>
                        <CardDescription>
                            {categories.filter(c => c.shop_section_visible && c.is_active).length} of {categories.filter(c => c.is_active).length} visible on shop page
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {categories.filter(c => c.is_active).map((category, index) => (
                                <div
                                    key={category.id}
                                    className={`flex items-center gap-3 p-4 ${!category.shop_section_visible ? 'opacity-50 bg-muted/30' : ''}`}
                                >
                                    {/* Drag Handle / Order Indicator */}
                                    <div className="flex flex-col items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => moveUp(categories.filter(c => c.is_active).indexOf(category))}
                                            disabled={index === 0}
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => moveDown(categories.filter(c => c.is_active).indexOf(category))}
                                            disabled={index === categories.filter(c => c.is_active).length - 1}
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Category Image */}
                                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                        {category.image_url ? (
                                            <img
                                                src={category.image_url}
                                                alt={category.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <LayoutGrid className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Category Name */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{category.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Order: {index + 1}
                                        </p>
                                    </div>

                                    {/* Visibility Toggle */}
                                    <div className="flex items-center gap-2">
                                        {category.shop_section_visible ? (
                                            <Eye className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <Switch
                                            checked={category.shop_section_visible}
                                            onCheckedChange={() => toggleVisibility(category.id)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Note for inactive categories */}
                {categories.some(c => !c.is_active) && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                        Note: Inactive categories are hidden from this list. Activate them first to manage their shop section visibility.
                    </p>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
