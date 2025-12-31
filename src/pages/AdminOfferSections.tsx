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
import { ArrowLeft, Plus, Pencil, Trash2, Percent, Tag, Layers } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';

interface OfferSection {
    id: string;
    name: string;
    title: string;
    subtitle: string | null;
    background_type: string;
    background_value: string;
    text_color: string;
    filter_type: string;
    filter_config: Record<string, any>;
    max_products: number;
    show_see_all: boolean;
    is_active: boolean;
    display_order: number;
}

interface Category {
    id: string;
    name: string;
}

const PRESET_GRADIENTS = [
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
];

export default function AdminOfferSections() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [sections, setSections] = useState<OfferSection[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingSection, setEditingSection] = useState<OfferSection | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        title: '',
        subtitle: '',
        background_type: 'gradient',
        background_value: PRESET_GRADIENTS[0],
        text_color: '#ffffff',
        filter_type: 'discount',
        min_discount: 40,
        max_discount: 60,
        category_ids: [] as string[],
        max_products: 10,
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
        fetchSections();
        fetchCategories();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchSections = async () => {
        try {
            const { data } = await (supabase as any)
                .from('offer_sections')
                .select('*')
                .order('display_order', { ascending: true });

            if (data) setSections(data);
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('id, name').order('name');
        if (data) setCategories(data);
    };

    const openAddDialog = () => {
        setEditingSection(null);
        setFormData({
            name: '',
            title: '',
            subtitle: '',
            background_type: 'gradient',
            background_value: PRESET_GRADIENTS[0],
            text_color: '#ffffff',
            filter_type: 'discount',
            min_discount: 40,
            max_discount: 60,
            category_ids: [],
            max_products: 10,
            show_see_all: true,
            is_active: true,
            display_order: sections.length,
        });
        setShowDialog(true);
    };

    const openEditDialog = (section: OfferSection) => {
        setEditingSection(section);
        const config = section.filter_config || {};
        setFormData({
            name: section.name,
            title: section.title,
            subtitle: section.subtitle || '',
            background_type: section.background_type,
            background_value: section.background_value,
            text_color: section.text_color,
            filter_type: section.filter_type,
            min_discount: config.min_discount || 0,
            max_discount: config.max_discount || 100,
            category_ids: config.category_ids || [],
            max_products: section.max_products,
            show_see_all: section.show_see_all,
            is_active: section.is_active,
            display_order: section.display_order,
        });
        setShowDialog(true);
    };

    const buildFilterConfig = () => {
        switch (formData.filter_type) {
            case 'discount':
                return { min_discount: formData.min_discount, max_discount: formData.max_discount };
            case 'category':
                return { category_ids: formData.category_ids };
            default:
                return {};
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.title.trim()) {
            toast.error('Name and title are required');
            return;
        }

        try {
            const sectionData = {
                name: formData.name,
                title: formData.title,
                subtitle: formData.subtitle || null,
                background_type: formData.background_type,
                background_value: formData.background_value,
                text_color: formData.text_color,
                filter_type: formData.filter_type,
                filter_config: buildFilterConfig(),
                max_products: formData.max_products,
                show_see_all: formData.show_see_all,
                is_active: formData.is_active,
                display_order: formData.display_order,
                updated_at: new Date().toISOString(),
            };

            if (editingSection) {
                await (supabase as any).from('offer_sections').update(sectionData).eq('id', editingSection.id);
                toast.success('Section updated');
            } else {
                await (supabase as any).from('offer_sections').insert(sectionData);
                toast.success('Section created');
            }

            setShowDialog(false);
            fetchSections();
        } catch (error) {
            toast.error('Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this offer section?')) return;
        try {
            await (supabase as any).from('offer_sections').delete().eq('id', id);
            toast.success('Deleted');
            fetchSections();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const toggleActive = async (section: OfferSection) => {
        try {
            await (supabase as any).from('offer_sections').update({ is_active: !section.is_active }).eq('id', section.id);
            fetchSections();
        } catch (error) {
            toast.error('Failed');
        }
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
                        <div>
                            <h1 className="text-lg font-bold">Offer Sections</h1>
                            <p className="text-xs text-muted-foreground">50% OFF Zone, etc.</p>
                        </div>
                    </div>
                    <Button onClick={openAddDialog} size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Add Section
                    </Button>
                </div>
            </header>

            {/* List */}
            <div className="container mx-auto px-4 py-6 space-y-4">
                {sections.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No offer sections yet</p>
                            <Button onClick={openAddDialog} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" /> Create First Section
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    sections.map(section => (
                        <Card key={section.id} className={!section.is_active ? 'opacity-60' : ''}>
                            <div
                                className="h-16 rounded-t-lg flex items-center p-4"
                                style={{ background: section.background_value, color: section.text_color }}
                            >
                                <h3 className="font-bold">{section.title}</h3>
                            </div>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={section.is_active ? 'default' : 'secondary'}>
                                                {section.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                            <Badge variant="outline">{section.filter_type}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{section.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={section.is_active} onCheckedChange={() => toggleActive(section)} />
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(section)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(section.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSection ? 'Edit Offer Section' : 'Create Offer Section'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Internal Name *</Label>
                                <Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="50-off-zone" />
                            </div>
                            <div className="space-y-2">
                                <Label>Display Title *</Label>
                                <Input value={formData.title} onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))} placeholder="50% OFF Zone" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Subtitle</Label>
                            <Input value={formData.subtitle} onChange={(e) => setFormData(f => ({ ...f, subtitle: e.target.value }))} placeholder="Half the price, double the joy!" />
                        </div>

                        <div className="space-y-2">
                            <Label>Background Gradient</Label>
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

                        <div className="space-y-2">
                            <Label>Filter Type</Label>
                            <Select value={formData.filter_type} onValueChange={(v) => setFormData(f => ({ ...f, filter_type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="discount">By Discount %</SelectItem>
                                    <SelectItem value="category">By Category</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.filter_type === 'discount' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Min Discount %</Label>
                                    <Input type="number" value={formData.min_discount} onChange={(e) => setFormData(f => ({ ...f, min_discount: parseInt(e.target.value) || 0 }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Discount %</Label>
                                    <Input type="number" value={formData.max_discount} onChange={(e) => setFormData(f => ({ ...f, max_discount: parseInt(e.target.value) || 100 }))} />
                                </div>
                            </div>
                        )}

                        {formData.filter_type === 'category' && (
                            <div className="space-y-2">
                                <Label>Categories</Label>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            className={`px-2 py-1 text-xs rounded-full border ${formData.category_ids.includes(cat.id) ? 'bg-primary text-white' : 'bg-muted'}`}
                                            onClick={() => {
                                                setFormData(f => ({
                                                    ...f,
                                                    category_ids: f.category_ids.includes(cat.id)
                                                        ? f.category_ids.filter(id => id !== cat.id)
                                                        : [...f.category_ids, cat.id]
                                                }));
                                            }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Max Products</Label>
                                <Input type="number" value={formData.max_products} onChange={(e) => setFormData(f => ({ ...f, max_products: parseInt(e.target.value) || 10 }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Display Order</Label>
                                <Input type="number" value={formData.display_order} onChange={(e) => setFormData(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
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
                        <Button onClick={handleSave}>{editingSection ? 'Save' : 'Create'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminBottomNav />
        </div>
    );
}
