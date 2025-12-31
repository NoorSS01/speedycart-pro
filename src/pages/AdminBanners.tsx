import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, Megaphone } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';

interface Banner {
    id: string;
    title: string;
    subtitle: string | null;
    image_url: string | null;
    link_url: string | null;
    background_color: string;
    text_color: string;
    is_active: boolean;
    display_order: number;
}

export default function AdminBanners() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        background_color: '#22c55e',
        text_color: '#ffffff',
        is_active: true,
    });

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    useEffect(() => {
        if (authLoading) return;
        if (!user || !isAdmin) {
            navigate('/');
            return;
        }
        fetchBanners();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchBanners = async () => {
        const { data } = await supabase
            .from('promotional_banners' as any)
            .select('*')
            .order('display_order', { ascending: true });

        if (data) {
            setBanners(data as unknown as Banner[]);
        }
        setLoading(false);
    };

    const openAddDialog = () => {
        setEditingBanner(null);
        setFormData({
            title: '',
            subtitle: '',
            background_color: '#22c55e',
            text_color: '#ffffff',
            is_active: true,
        });
        setShowDialog(true);
    };

    const openEditDialog = (banner: Banner) => {
        setEditingBanner(banner);
        setFormData({
            title: banner.title,
            subtitle: banner.subtitle || '',
            background_color: banner.background_color,
            text_color: banner.text_color,
            is_active: banner.is_active,
        });
        setShowDialog(true);
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            toast.error('Title is required');
            return;
        }

        try {
            if (editingBanner) {
                // Update existing
                await (supabase as any)
                    .from('promotional_banners')
                    .update({
                        title: formData.title,
                        subtitle: formData.subtitle || null,
                        background_color: formData.background_color,
                        text_color: formData.text_color,
                        is_active: formData.is_active,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingBanner.id);
                toast.success('Banner updated');
            } else {
                // Insert new
                const maxOrder = banners.length > 0
                    ? Math.max(...banners.map(b => b.display_order)) + 1
                    : 1;

                await (supabase as any)
                    .from('promotional_banners')
                    .insert({
                        title: formData.title,
                        subtitle: formData.subtitle || null,
                        background_color: formData.background_color,
                        text_color: formData.text_color,
                        is_active: formData.is_active,
                        display_order: maxOrder,
                    });
                toast.success('Banner created');
            }

            setShowDialog(false);
            fetchBanners();
        } catch (e) {
            toast.error('Failed to save banner');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this banner?')) return;

        try {
            await (supabase as any)
                .from('promotional_banners')
                .delete()
                .eq('id', id);
            toast.success('Banner deleted');
            fetchBanners();
        } catch (e) {
            toast.error('Failed to delete');
        }
    };

    const toggleActive = async (banner: Banner) => {
        try {
            await (supabase as any)
                .from('promotional_banners')
                .update({ is_active: !banner.is_active })
                .eq('id', banner.id);
            fetchBanners();
        } catch (e) {
            toast.error('Failed to update');
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
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
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
                        <div className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5 text-primary" />
                            <h1 className="text-lg font-bold">Promotional Banners</h1>
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
                            <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No promotional banners yet</p>
                            <Button onClick={openAddDialog} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" /> Create First Banner
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    banners.map(banner => (
                        <Card key={banner.id} className={!banner.is_active ? 'opacity-50' : ''}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
                                    <div
                                        className="w-16 h-12 rounded flex items-center justify-center text-xs font-bold"
                                        style={{
                                            backgroundColor: banner.background_color,
                                            color: banner.text_color
                                        }}
                                    >
                                        Preview
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{banner.title}</h3>
                                        {banner.subtitle && (
                                            <p className="text-sm text-muted-foreground">{banner.subtitle}</p>
                                        )}
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingBanner ? 'Edit Banner' : 'Add New Banner'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                                placeholder="e.g., Free Delivery on Water 💧"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Subtitle</Label>
                            <Input
                                value={formData.subtitle}
                                onChange={(e) => setFormData(f => ({ ...f, subtitle: e.target.value }))}
                                placeholder="e.g., Order only water products for free delivery!"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Background Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={formData.background_color}
                                        onChange={(e) => setFormData(f => ({ ...f, background_color: e.target.value }))}
                                        className="w-12 h-10 p-1 cursor-pointer"
                                    />
                                    <Input
                                        value={formData.background_color}
                                        onChange={(e) => setFormData(f => ({ ...f, background_color: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Text Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={formData.text_color}
                                        onChange={(e) => setFormData(f => ({ ...f, text_color: e.target.value }))}
                                        className="w-12 h-10 p-1 cursor-pointer"
                                    />
                                    <Input
                                        value={formData.text_color}
                                        onChange={(e) => setFormData(f => ({ ...f, text_color: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                        {/* Preview */}
                        <div className="space-y-2">
                            <Label>Preview</Label>
                            <div
                                className="rounded-xl p-4 min-h-[60px]"
                                style={{
                                    backgroundColor: formData.background_color,
                                    color: formData.text_color
                                }}
                            >
                                <h3 className="font-bold">{formData.title || 'Banner Title'}</h3>
                                {formData.subtitle && (
                                    <p className="text-sm opacity-90">{formData.subtitle}</p>
                                )}
                            </div>
                        </div>
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
