import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import { ArrowLeft, Plus, Pencil, Trash2, Zap, Clock } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { format } from 'date-fns';

interface FlashDeal {
    id: string;
    name: string;
    title: string;
    badge_text: string | null;
    badge_color: string;
    start_time: string;
    end_time: string;
    background_color: string;
    text_color: string;
    timer_bg_color: string;
    timer_text_color: string;
    filter_type: string;
    filter_config: Record<string, any>;
    max_products: number;
    show_see_all: boolean;
    is_active: boolean;
    display_order: number;
}

export default function AdminFlashDeals() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [deals, setDeals] = useState<FlashDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingDeal, setEditingDeal] = useState<FlashDeal | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        title: 'FLASH DEALS',
        badge_text: 'Up To 80% Off',
        badge_color: '#ec4899',
        start_time: '',
        end_time: '',
        background_color: '#fef3c7',
        text_color: '#000000',
        timer_bg_color: '#1e293b',
        timer_text_color: '#ffffff',
        filter_type: 'discount',
        min_discount: 30,
        max_products: 8,
        show_see_all: true,
        is_active: true,
        display_order: 0,
    });

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    useEffect(() => {
        if (authLoading) return;
        if (!user || !isAdmin) {
            navigate('/');
            return;
        }
        fetchDeals();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchDeals = async () => {
        try {
            const { data } = await (supabase as any)
                .from('flash_deals')
                .select('*')
                .order('display_order', { ascending: true });

            if (data) setDeals(data);
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const openAddDialog = () => {
        // Default: starts now, ends in 24 hours
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        setEditingDeal(null);
        setFormData({
            name: '',
            title: 'FLASH DEALS',
            badge_text: 'Up To 80% Off',
            badge_color: '#ec4899',
            start_time: format(now, "yyyy-MM-dd'T'HH:mm"),
            end_time: format(tomorrow, "yyyy-MM-dd'T'HH:mm"),
            background_color: '#fef3c7',
            text_color: '#000000',
            timer_bg_color: '#1e293b',
            timer_text_color: '#ffffff',
            filter_type: 'discount',
            min_discount: 30,
            max_products: 8,
            show_see_all: true,
            is_active: true,
            display_order: deals.length,
        });
        setShowDialog(true);
    };

    const openEditDialog = (deal: FlashDeal) => {
        setEditingDeal(deal);
        const config = deal.filter_config || {};
        setFormData({
            name: deal.name,
            title: deal.title,
            badge_text: deal.badge_text || '',
            badge_color: deal.badge_color,
            start_time: format(new Date(deal.start_time), "yyyy-MM-dd'T'HH:mm"),
            end_time: format(new Date(deal.end_time), "yyyy-MM-dd'T'HH:mm"),
            background_color: deal.background_color,
            text_color: deal.text_color,
            timer_bg_color: deal.timer_bg_color,
            timer_text_color: deal.timer_text_color,
            filter_type: deal.filter_type,
            min_discount: config.min_discount || 30,
            max_products: deal.max_products,
            show_see_all: deal.show_see_all,
            is_active: deal.is_active,
            display_order: deal.display_order,
        });
        setShowDialog(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.title.trim()) {
            toast.error('Name and title required');
            return;
        }

        if (!formData.start_time || !formData.end_time) {
            toast.error('Start and end times required');
            return;
        }

        try {
            const dealData = {
                name: formData.name,
                title: formData.title,
                badge_text: formData.badge_text || null,
                badge_color: formData.badge_color,
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
                background_color: formData.background_color,
                text_color: formData.text_color,
                timer_bg_color: formData.timer_bg_color,
                timer_text_color: formData.timer_text_color,
                filter_type: formData.filter_type,
                filter_config: { min_discount: formData.min_discount },
                max_products: formData.max_products,
                show_see_all: formData.show_see_all,
                is_active: formData.is_active,
                display_order: formData.display_order,
                updated_at: new Date().toISOString(),
            };

            if (editingDeal) {
                await (supabase as any).from('flash_deals').update(dealData).eq('id', editingDeal.id);
                toast.success('Flash deal updated');
            } else {
                await (supabase as any).from('flash_deals').insert(dealData);
                toast.success('Flash deal created');
            }

            setShowDialog(false);
            fetchDeals();
        } catch (error) {
            toast.error('Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this flash deal?')) return;
        try {
            await (supabase as any).from('flash_deals').delete().eq('id', id);
            toast.success('Deleted');
            fetchDeals();
        } catch (error) {
            toast.error('Failed');
        }
    };

    const toggleActive = async (deal: FlashDeal) => {
        try {
            await (supabase as any).from('flash_deals').update({ is_active: !deal.is_active }).eq('id', deal.id);
            fetchDeals();
        } catch (error) {
            toast.error('Failed');
        }
    };

    const getDealStatus = (deal: FlashDeal) => {
        const now = new Date();
        const start = new Date(deal.start_time);
        const end = new Date(deal.end_time);

        if (!deal.is_active) return { label: 'Inactive', color: 'secondary' };
        if (now < start) return { label: 'Scheduled', color: 'outline' };
        if (now > end) return { label: 'Expired', color: 'destructive' };
        return { label: 'Live', color: 'default' };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pb-20">
                <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                    <div className="container mx-auto px-4 py-4">
                        <Skeleton className="h-6 w-40" />
                    </div>
                </header>
                <div className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
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
                            <h1 className="text-lg font-bold flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-500" /> Flash Deals
                            </h1>
                            <p className="text-xs text-muted-foreground">Time-limited offers</p>
                        </div>
                    </div>
                    <Button onClick={openAddDialog} size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Add Deal
                    </Button>
                </div>
            </header>

            {/* List */}
            <div className="container mx-auto px-4 py-6 space-y-4">
                {deals.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No flash deals yet</p>
                            <Button onClick={openAddDialog} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" /> Create First Deal
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    deals.map(deal => {
                        const status = getDealStatus(deal);
                        return (
                            <Card key={deal.id} className={!deal.is_active ? 'opacity-60' : ''}>
                                <div
                                    className="p-4 rounded-t-lg flex items-center justify-between"
                                    style={{ backgroundColor: deal.background_color, color: deal.text_color }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-5 w-5" />
                                        <span className="font-bold">{deal.title}</span>
                                        {deal.badge_text && (
                                            <span
                                                className="text-xs px-2 py-0.5 rounded-full text-white"
                                                style={{ backgroundColor: deal.badge_color }}
                                            >
                                                {deal.badge_text}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-sm">
                                        <Clock className="h-4 w-4" />
                                        <span>{format(new Date(deal.end_time), 'MMM d, HH:mm')}</span>
                                    </div>
                                </div>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={status.color as any}>{status.label}</Badge>
                                                <span className="text-xs text-muted-foreground">{deal.name}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(deal.start_time), 'MMM d HH:mm')} - {format(new Date(deal.end_time), 'MMM d HH:mm')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch checked={deal.is_active} onCheckedChange={() => toggleActive(deal)} />
                                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(deal)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(deal.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingDeal ? 'Edit Flash Deal' : 'Create Flash Deal'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Internal Name *</Label>
                                <Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="new-year-flash" />
                            </div>
                            <div className="space-y-2">
                                <Label>Display Title *</Label>
                                <Input value={formData.title} onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))} placeholder="FLASH DEALS" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Badge Text</Label>
                                <Input value={formData.badge_text} onChange={(e) => setFormData(f => ({ ...f, badge_text: e.target.value }))} placeholder="Up To 80% Off" />
                            </div>
                            <div className="space-y-2">
                                <Label>Badge Color</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={formData.badge_color} onChange={(e) => setFormData(f => ({ ...f, badge_color: e.target.value }))} className="h-10 w-14" />
                                    <Input value={formData.badge_color} onChange={(e) => setFormData(f => ({ ...f, badge_color: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time *</Label>
                                <Input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData(f => ({ ...f, start_time: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time *</Label>
                                <Input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData(f => ({ ...f, end_time: e.target.value }))} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Background Color</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={formData.background_color} onChange={(e) => setFormData(f => ({ ...f, background_color: e.target.value }))} className="h-10 w-14" />
                                    <Input value={formData.background_color} onChange={(e) => setFormData(f => ({ ...f, background_color: e.target.value }))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Timer Background</Label>
                                <div className="flex gap-2">
                                    <input type="color" value={formData.timer_bg_color} onChange={(e) => setFormData(f => ({ ...f, timer_bg_color: e.target.value }))} className="h-10 w-14" />
                                    <Input value={formData.timer_bg_color} onChange={(e) => setFormData(f => ({ ...f, timer_bg_color: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Min Discount %</Label>
                                <Input type="number" value={formData.min_discount} onChange={(e) => setFormData(f => ({ ...f, min_discount: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Products</Label>
                                <Input type="number" value={formData.max_products} onChange={(e) => setFormData(f => ({ ...f, max_products: parseInt(e.target.value) || 8 }))} />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Switch id="seeall" checked={formData.show_see_all} onCheckedChange={(checked) => setFormData(f => ({ ...f, show_see_all: checked }))} />
                                <Label htmlFor="seeall">Show "See All"</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="active" checked={formData.is_active} onCheckedChange={(checked) => setFormData(f => ({ ...f, is_active: checked }))} />
                                <Label htmlFor="active">Active</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button onClick={handleSave}>{editingDeal ? 'Save' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminBottomNav />
        </div>
    );
}
