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
import {
    ArrowLeft, Plus, Pencil, Trash2, Zap, UserPlus,
    Clock, ShoppingCart, Award, Calendar, Percent, DollarSign
} from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';

interface CouponTrigger {
    id: string;
    name: string;
    description: string | null;
    trigger_type: string;
    conditions: Record<string, any>;
    discount_type: string;
    discount_value: number;
    min_order_amount: number;
    max_discount: number | null;
    coupon_code_prefix: string;
    coupon_valid_days: number;
    max_uses_per_user: number;
    is_active: boolean;
    priority: number;
}

const TRIGGER_TYPES = [
    { value: 'new_user', label: 'New User', icon: UserPlus, description: 'First signup or first order' },
    { value: 'inactivity', label: 'Inactivity', icon: Clock, description: 'User hasn\'t ordered in X days' },
    { value: 'cart_abandonment', label: 'Cart Abandonment', icon: ShoppingCart, description: 'Added items but didn\'t checkout' },
    { value: 'loyalty', label: 'Loyalty Reward', icon: Award, description: 'Reward frequent shoppers' },
    { value: 'scheduled', label: 'Scheduled', icon: Calendar, description: 'Time-based promotions' },
];

export default function AdminCouponTriggers() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [triggers, setTriggers] = useState<CouponTrigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingTrigger, setEditingTrigger] = useState<CouponTrigger | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        trigger_type: 'new_user',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_amount: 0,
        max_discount: 50,
        coupon_code_prefix: 'AUTO',
        coupon_valid_days: 7,
        max_uses_per_user: 1,
        is_active: true,
        // Condition fields
        days_inactive: 7,
        min_orders: 5,
        min_total_spend: 1000,
    });

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    useEffect(() => {
        if (authLoading) return;
        if (!user || !isAdmin) {
            navigate('/');
            return;
        }
        fetchTriggers();
    }, [user, authLoading, isAdmin, navigate]);

    const fetchTriggers = async () => {
        try {
            const { data } = await supabase
                .from('coupon_triggers' as any)
                .select('*')
                .order('priority', { ascending: false });

            if (data) {
                setTriggers(data as unknown as CouponTrigger[]);
            }
        } catch (error) {
            console.error('Error fetching triggers:', error);
        }
        setLoading(false);
    };

    const openAddDialog = () => {
        setEditingTrigger(null);
        setFormData({
            name: '',
            description: '',
            trigger_type: 'new_user',
            discount_type: 'percentage',
            discount_value: 10,
            min_order_amount: 0,
            max_discount: 50,
            coupon_code_prefix: 'AUTO',
            coupon_valid_days: 7,
            max_uses_per_user: 1,
            is_active: true,
            days_inactive: 7,
            min_orders: 5,
            min_total_spend: 1000,
        });
        setShowDialog(true);
    };

    const openEditDialog = (trigger: CouponTrigger) => {
        setEditingTrigger(trigger);
        const conditions = trigger.conditions || {};
        setFormData({
            name: trigger.name,
            description: trigger.description || '',
            trigger_type: trigger.trigger_type,
            discount_type: trigger.discount_type,
            discount_value: trigger.discount_value,
            min_order_amount: trigger.min_order_amount,
            max_discount: trigger.max_discount || 50,
            coupon_code_prefix: trigger.coupon_code_prefix,
            coupon_valid_days: trigger.coupon_valid_days,
            max_uses_per_user: trigger.max_uses_per_user,
            is_active: trigger.is_active,
            days_inactive: conditions.days_inactive || 7,
            min_orders: conditions.min_orders || 5,
            min_total_spend: conditions.min_total_spend || 1000,
        });
        setShowDialog(true);
    };

    const buildConditions = () => {
        const conditions: Record<string, any> = {};

        switch (formData.trigger_type) {
            case 'inactivity':
                conditions.days_inactive = formData.days_inactive;
                break;
            case 'loyalty':
                conditions.min_orders = formData.min_orders;
                conditions.min_total_spend = formData.min_total_spend;
                break;
            case 'cart_abandonment':
                conditions.hours_abandoned = 24; // Default 24 hours
                break;
        }

        return conditions;
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        try {
            const triggerData = {
                name: formData.name,
                description: formData.description || null,
                trigger_type: formData.trigger_type,
                conditions: buildConditions(),
                discount_type: formData.discount_type,
                discount_value: formData.discount_value,
                min_order_amount: formData.min_order_amount,
                max_discount: formData.discount_type === 'percentage' ? formData.max_discount : null,
                coupon_code_prefix: formData.coupon_code_prefix.toUpperCase(),
                coupon_valid_days: formData.coupon_valid_days,
                max_uses_per_user: formData.max_uses_per_user,
                is_active: formData.is_active,
                updated_at: new Date().toISOString(),
            };

            if (editingTrigger) {
                await (supabase as any)
                    .from('coupon_triggers')
                    .update(triggerData)
                    .eq('id', editingTrigger.id);
                toast.success('Trigger updated');
            } else {
                await (supabase as any)
                    .from('coupon_triggers')
                    .insert(triggerData);
                toast.success('Trigger created');
            }

            setShowDialog(false);
            fetchTriggers();
        } catch (e) {
            toast.error('Failed to save trigger');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this coupon trigger?')) return;

        try {
            await (supabase as any)
                .from('coupon_triggers')
                .delete()
                .eq('id', id);
            toast.success('Trigger deleted');
            fetchTriggers();
        } catch (e) {
            toast.error('Failed to delete');
        }
    };

    const toggleActive = async (trigger: CouponTrigger) => {
        try {
            await (supabase as any)
                .from('coupon_triggers')
                .update({ is_active: !trigger.is_active })
                .eq('id', trigger.id);
            fetchTriggers();
        } catch (e) {
            toast.error('Failed to update');
        }
    };

    const getTriggerIcon = (type: string) => {
        const found = TRIGGER_TYPES.find(t => t.value === type);
        return found ? found.icon : Zap;
    };

    const getTriggerLabel = (type: string) => {
        const found = TRIGGER_TYPES.find(t => t.value === type);
        return found ? found.label : type;
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
                            <Zap className="h-5 w-5 text-primary" />
                            <h1 className="text-lg font-bold">Coupon Triggers</h1>
                        </div>
                    </div>
                    <Button onClick={openAddDialog} size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Add Trigger
                    </Button>
                </div>
            </header>

            {/* Info Banner */}
            <div className="container mx-auto px-4 py-4">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Automatic Coupon Triggers
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create rules to automatically give coupons to users based on their behavior -
                        like welcoming new users, re-engaging inactive customers, or rewarding loyalty.
                    </p>
                </div>
            </div>

            {/* Triggers List */}
            <div className="container mx-auto px-4 py-2 space-y-4">
                {triggers.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No coupon triggers yet</p>
                            <Button onClick={openAddDialog} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" /> Create First Trigger
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    triggers.map(trigger => {
                        const TriggerIcon = getTriggerIcon(trigger.trigger_type);
                        return (
                            <Card key={trigger.id} className={!trigger.is_active ? 'opacity-60' : ''}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <TriggerIcon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold">{trigger.name}</h3>
                                                <Badge variant={trigger.is_active ? 'default' : 'secondary'}>
                                                    {trigger.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                {trigger.description || getTriggerLabel(trigger.trigger_type)}
                                            </p>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <Badge variant="outline">
                                                    {trigger.discount_type === 'percentage'
                                                        ? `${trigger.discount_value}% off`
                                                        : `₹${trigger.discount_value} off`}
                                                </Badge>
                                                {trigger.min_order_amount > 0 && (
                                                    <Badge variant="outline">
                                                        Min ₹{trigger.min_order_amount}
                                                    </Badge>
                                                )}
                                                <Badge variant="outline">
                                                    Valid {trigger.coupon_valid_days} days
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={trigger.is_active}
                                                onCheckedChange={() => toggleActive(trigger)}
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(trigger)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(trigger.id)}>
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

            {/* Add/Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTrigger ? 'Edit Coupon Trigger' : 'Create Coupon Trigger'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Basic Info */}
                        <div className="space-y-2">
                            <Label>Trigger Name *</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g., Welcome Discount"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                                placeholder="e.g., 10% off for new users"
                            />
                        </div>

                        {/* Trigger Type */}
                        <div className="space-y-2">
                            <Label>Trigger Type</Label>
                            <Select
                                value={formData.trigger_type}
                                onValueChange={(value) => setFormData(f => ({ ...f, trigger_type: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRIGGER_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>
                                            <div className="flex items-center gap-2">
                                                <type.icon className="h-4 w-4" />
                                                <span>{type.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {TRIGGER_TYPES.find(t => t.value === formData.trigger_type)?.description}
                            </p>
                        </div>

                        {/* Condition Fields based on type */}
                        {formData.trigger_type === 'inactivity' && (
                            <div className="space-y-2">
                                <Label>Days Inactive</Label>
                                <Input
                                    type="number"
                                    value={formData.days_inactive}
                                    onChange={(e) => setFormData(f => ({ ...f, days_inactive: parseInt(e.target.value) || 7 }))}
                                    min={1}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Trigger if user hasn't ordered in this many days
                                </p>
                            </div>
                        )}

                        {formData.trigger_type === 'loyalty' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Minimum Orders</Label>
                                    <Input
                                        type="number"
                                        value={formData.min_orders}
                                        onChange={(e) => setFormData(f => ({ ...f, min_orders: parseInt(e.target.value) || 5 }))}
                                        min={1}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Minimum Total Spend (₹)</Label>
                                    <Input
                                        type="number"
                                        value={formData.min_total_spend}
                                        onChange={(e) => setFormData(f => ({ ...f, min_total_spend: parseInt(e.target.value) || 0 }))}
                                        min={0}
                                    />
                                </div>
                            </>
                        )}

                        {/* Discount Settings */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Discount Type</Label>
                                <Select
                                    value={formData.discount_type}
                                    onValueChange={(value) => setFormData(f => ({ ...f, discount_type: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">
                                            <div className="flex items-center gap-2">
                                                <Percent className="h-4 w-4" />
                                                Percentage
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="fixed">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4" />
                                                Fixed Amount
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Discount Value {formData.discount_type === 'percentage' ? '(%)' : '(₹)'}
                                </Label>
                                <Input
                                    type="number"
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData(f => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))}
                                    min={0}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Min Order Amount (₹)</Label>
                                <Input
                                    type="number"
                                    value={formData.min_order_amount}
                                    onChange={(e) => setFormData(f => ({ ...f, min_order_amount: parseFloat(e.target.value) || 0 }))}
                                    min={0}
                                />
                            </div>
                            {formData.discount_type === 'percentage' && (
                                <div className="space-y-2">
                                    <Label>Max Discount Cap (₹)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_discount}
                                        onChange={(e) => setFormData(f => ({ ...f, max_discount: parseFloat(e.target.value) || 0 }))}
                                        min={0}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Coupon Settings */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Code Prefix</Label>
                                <Input
                                    value={formData.coupon_code_prefix}
                                    onChange={(e) => setFormData(f => ({ ...f, coupon_code_prefix: e.target.value.toUpperCase() }))}
                                    placeholder="WELCOME"
                                    maxLength={10}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Valid Days</Label>
                                <Input
                                    type="number"
                                    value={formData.coupon_valid_days}
                                    onChange={(e) => setFormData(f => ({ ...f, coupon_valid_days: parseInt(e.target.value) || 7 }))}
                                    min={1}
                                />
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
                            {editingTrigger ? 'Save Changes' : 'Create Trigger'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminBottomNav />
        </div>
    );
}
