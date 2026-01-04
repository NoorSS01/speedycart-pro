import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { ArrowLeft, Plus, Pencil, Trash2, Image, Palette, Type, Link, Search, Package } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';

interface HeroBanner {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    background_type: string;
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
    click_type: string;
    click_target: string | null;
    is_active: boolean;
    display_order: number;
}

interface Category {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
    image_url: string | null;
}

const PRESET_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
];

export default function AdminHeroBanners() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [banners, setBanners] = useState<HeroBanner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingBanner, setEditingBanner] = useState<HeroBanner | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        description: '',
        background_type: 'gradient',
        background_value: PRESET_GRADIENTS[0],
        image_url: '',
        image_position: 'right',
        text_color: '#ffffff',
        text_align: 'left',
        button_text: '',
        button_link: '',
        button_bg_color: '#ffffff',
        button_text_color: '#000000',
        height: '200px',
        border_radius: '16px',
        click_type: 'none',
        click_target: '',
        is_active: true,
        display_order: 0,
    });
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState('');

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    useEffect(() => {
        if (authLoading) return;
        if (!user || !isAdmin) {
            navigate('/');
            return;
        }
        fetchBanners();
        fetchCategories();
        fetchProducts();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchBanners = async () => {
        try {
            const { data } = await supabase
                .from('hero_banners')
                .select('*')
                .order('display_order', { ascending: true });

            if (data) setBanners(data);
        } catch (error) {
            logger.error('Failed to fetch hero banners', { error });
        }
        setLoading(false);
    };

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('id, name').eq('is_active', true).order('name');
        if (data) setCategories(data);
    };

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name, image_url').eq('is_active', true).order('name');
        if (data) setProducts(data);
    };

    const openAddDialog = () => {
        setEditingBanner(null);
        setFormData({
            title: '',
            subtitle: '',
            description: '',
            background_type: 'gradient',
            background_value: PRESET_GRADIENTS[0],
            image_url: '',
            image_position: 'right',
            text_color: '#ffffff',
            text_align: 'left',
            button_text: '',
            button_link: '',
            button_bg_color: '#ffffff',
            button_text_color: '#000000',
            height: '200px',
            border_radius: '16px',
            click_type: 'none',
            click_target: '',
            is_active: true,
            display_order: banners.length,
        });
        setProductSearch('');
        setShowDialog(true);
    };

    const openEditDialog = (banner: HeroBanner) => {
        setEditingBanner(banner);
        setFormData({
            title: banner.title,
            subtitle: banner.subtitle || '',
            description: banner.description || '',
            background_type: banner.background_type,
            background_value: banner.background_value,
            image_url: banner.image_url || '',
            image_position: banner.image_position,
            text_color: banner.text_color,
            text_align: banner.text_align,
            button_text: banner.button_text || '',
            button_link: banner.button_link || '',
            button_bg_color: banner.button_bg_color,
            button_text_color: banner.button_text_color,
            height: banner.height,
            border_radius: banner.border_radius,
            click_type: banner.click_type || 'none',
            click_target: banner.click_target || '',
            is_active: banner.is_active,
            display_order: banner.display_order,
        });
        setProductSearch('');
        setShowDialog(true);
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            toast.error('Title is required');
            return;
        }

        try {
            const bannerData = {
                ...formData,
                subtitle: formData.subtitle || null,
                description: formData.description || null,
                image_url: formData.image_url || null,
                button_text: formData.button_text || null,
                button_link: formData.button_link || null,
                click_type: formData.click_type,
                click_target: formData.click_target || null,
                updated_at: new Date().toISOString(),
            };

            if (editingBanner) {
                await supabase
                    .from('hero_banners')
                    .update(bannerData)
                    .eq('id', editingBanner.id);
                toast.success('Banner updated');
            } else {
                await supabase
                    .from('hero_banners')
                    .insert(bannerData);
                toast.success('Banner created');
            }

            setShowDialog(false);
            fetchBanners();
        } catch (error) {
            toast.error('Failed to save banner');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this banner?')) return;

        try {
            await supabase.from('hero_banners').delete().eq('id', id);
            toast.success('Banner deleted');
            fetchBanners();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const toggleActive = async (banner: HeroBanner) => {
        try {
            await supabase
                .from('hero_banners')
                .update({ is_active: !banner.is_active })
                .eq('id', banner.id);
            fetchBanners();
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const getPreviewStyle = () => {
        const style: React.CSSProperties = {
            minHeight: formData.height,
            borderRadius: formData.border_radius,
            color: formData.text_color,
        };

        if (formData.background_type === 'gradient') {
            style.background = formData.background_value;
        } else if (formData.background_type === 'image') {
            style.backgroundImage = `url(${formData.background_value})`;
            style.backgroundSize = 'cover';
            style.backgroundPosition = 'center';
        } else {
            style.backgroundColor = formData.background_value;
        }

        return style;
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
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold">Hero Banners</h1>
                            <p className="text-xs text-muted-foreground">Large homepage banners</p>
                        </div>
                    </div>
                    <Button onClick={openAddDialog} size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Add Banner
                    </Button>
                </div>
            </header>

            {/* Banners List */}
            <div className="container mx-auto px-4 py-6 space-y-4">
                {banners.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No hero banners yet</p>
                            <Button onClick={openAddDialog} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" /> Create First Banner
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    banners.map(banner => (
                        <Card key={banner.id} className={!banner.is_active ? 'opacity-60' : ''}>
                            {/* Preview */}
                            <div
                                className="h-24 rounded-t-lg flex items-center p-4"
                                style={{
                                    background: banner.background_type === 'gradient' ? banner.background_value :
                                        banner.background_type === 'image' ? `url(${banner.background_value}) center/cover` :
                                            banner.background_value,
                                    color: banner.text_color,
                                }}
                            >
                                <div>
                                    <h3 className="font-bold text-lg">{banner.title}</h3>
                                    {banner.subtitle && <p className="text-sm opacity-90">{banner.subtitle}</p>}
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={banner.is_active ? 'default' : 'secondary'}>
                                            {banner.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            Order: {banner.display_order}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={banner.is_active}
                                            onCheckedChange={() => toggleActive(banner)}
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(banner)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(banner.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingBanner ? 'Edit Hero Banner' : 'Create Hero Banner'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Live Preview */}
                        <div className="space-y-2">
                            <Label>Preview</Label>
                            <div
                                className="relative overflow-hidden"
                                style={getPreviewStyle()}
                            >
                                <div className="p-4" style={{ textAlign: formData.text_align as any }}>
                                    <h2 className="text-xl font-bold">{formData.title || 'Banner Title'}</h2>
                                    {formData.subtitle && <p className="text-sm opacity-90">{formData.subtitle}</p>}
                                    {formData.button_text && (
                                        <button
                                            className="mt-2 px-4 py-1 rounded-full text-sm font-semibold"
                                            style={{ backgroundColor: formData.button_bg_color, color: formData.button_text_color }}
                                        >
                                            {formData.button_text}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                                placeholder="New Year Sale!"
                            />
                        </div>

                        {/* Subtitle */}
                        <div className="space-y-2">
                            <Label>Subtitle</Label>
                            <Input
                                value={formData.subtitle}
                                onChange={(e) => setFormData(f => ({ ...f, subtitle: e.target.value }))}
                                placeholder="Up to 50% off on everything"
                            />
                        </div>

                        {/* Background Type */}
                        <div className="space-y-2">
                            <Label>Background Type</Label>
                            <Select
                                value={formData.background_type}
                                onValueChange={(v) => setFormData(f => ({ ...f, background_type: v }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gradient">Gradient</SelectItem>
                                    <SelectItem value="color">Solid Color</SelectItem>
                                    <SelectItem value="image">Image URL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Background Value */}
                        {formData.background_type === 'gradient' ? (
                            <div className="space-y-2">
                                <Label>Select Gradient</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PRESET_GRADIENTS.map((g, i) => (
                                        <button
                                            key={i}
                                            className={`h-10 rounded-lg border-2 ${formData.background_value === g ? 'border-primary' : 'border-transparent'}`}
                                            style={{ background: g }}
                                            onClick={() => setFormData(f => ({ ...f, background_value: g }))}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : formData.background_type === 'color' ? (
                            <div className="space-y-2">
                                <Label>Background Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={formData.background_value}
                                        onChange={(e) => setFormData(f => ({ ...f, background_value: e.target.value }))}
                                        className="h-10 w-20"
                                    />
                                    <Input
                                        value={formData.background_value}
                                        onChange={(e) => setFormData(f => ({ ...f, background_value: e.target.value }))}
                                        placeholder="#ff5722"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Background Image URL</Label>
                                <Input
                                    value={formData.background_value}
                                    onChange={(e) => setFormData(f => ({ ...f, background_value: e.target.value }))}
                                    placeholder="https://..."
                                />
                            </div>
                        )}

                        {/* Text Color */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Text Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={formData.text_color}
                                        onChange={(e) => setFormData(f => ({ ...f, text_color: e.target.value }))}
                                        className="h-8 w-12"
                                    />
                                    <Input value={formData.text_color} onChange={(e) => setFormData(f => ({ ...f, text_color: e.target.value }))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Text Align</Label>
                                <Select
                                    value={formData.text_align}
                                    onValueChange={(v) => setFormData(f => ({ ...f, text_align: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="left">Left</SelectItem>
                                        <SelectItem value="center">Center</SelectItem>
                                        <SelectItem value="right">Right</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Button */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Button Text</Label>
                                <Input
                                    value={formData.button_text}
                                    onChange={(e) => setFormData(f => ({ ...f, button_text: e.target.value }))}
                                    placeholder="Shop Now"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Button Link</Label>
                                <Input
                                    value={formData.button_link}
                                    onChange={(e) => setFormData(f => ({ ...f, button_link: e.target.value }))}
                                    placeholder="/shop?category=sale"
                                />
                            </div>
                        </div>

                        {/* Click Navigation - What happens when banner is clicked */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Link className="h-4 w-4" />
                                Banner Click Action
                            </Label>
                            <Select
                                value={formData.click_type}
                                onValueChange={(v) => setFormData(f => ({ ...f, click_type: v, click_target: '' }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None (No Click)</SelectItem>
                                    <SelectItem value="category">Go to Category</SelectItem>
                                    <SelectItem value="product">Go to Product</SelectItem>
                                    <SelectItem value="url">Custom URL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Category Picker */}
                        {formData.click_type === 'category' && (
                            <div className="space-y-2">
                                <Label>Select Category</Label>
                                <Select
                                    value={formData.click_target}
                                    onValueChange={(v) => setFormData(f => ({ ...f, click_target: v }))}
                                >
                                    <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Product Picker */}
                        {formData.click_type === 'product' && (
                            <div className="space-y-2">
                                <Label>Select Product</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search products..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                                    {products
                                        .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                                        .slice(0, 15)
                                        .map(prod => (
                                            <button
                                                key={prod.id}
                                                type="button"
                                                className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm hover:bg-muted ${formData.click_target === prod.id ? 'bg-primary/10 border-primary border' : ''
                                                    }`}
                                                onClick={() => setFormData(f => ({ ...f, click_target: prod.id }))}
                                            >
                                                {prod.image_url ? (
                                                    <img src={prod.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                                        <Package className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <span className="flex-1 truncate">{prod.name}</span>
                                                {formData.click_target === prod.id && (
                                                    <span className="text-primary text-xs">✓</span>
                                                )}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Custom URL */}
                        {formData.click_type === 'url' && (
                            <div className="space-y-2">
                                <Label>Click URL</Label>
                                <Input
                                    value={formData.click_target}
                                    onChange={(e) => setFormData(f => ({ ...f, click_target: e.target.value }))}
                                    placeholder="/shop?category=sale or https://..."
                                />
                            </div>
                        )}

                        {/* Display Order */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Display Order</Label>
                                <Input
                                    type="number"
                                    value={formData.display_order}
                                    onChange={(e) => setFormData(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Height</Label>
                                <Input
                                    value={formData.height}
                                    onChange={(e) => setFormData(f => ({ ...f, height: e.target.value }))}
                                    placeholder="200px"
                                />
                            </div>
                        </div>

                        {/* Active Switch */}
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData(f => ({ ...f, is_active: checked }))}
                            />
                            <Label htmlFor="active">Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button onClick={handleSave}>
                            {editingBanner ? 'Save Changes' : 'Create Banner'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminBottomNav />
        </div>
    );
}
