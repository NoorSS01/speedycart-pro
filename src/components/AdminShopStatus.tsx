import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Clock, AlertCircle, Calendar } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ShopSettings {
    shop_status: 'open' | 'closed';
    closed_message: string;
    scheduled_open_time: string;
    scheduled_close_time: string;
    schedule_enabled: boolean;
}

export default function AdminShopStatus() {
    const [settings, setSettings] = useState<ShopSettings>({
        shop_status: 'open',
        closed_message: 'We are currently closed. Please try again later.',
        scheduled_open_time: '08:00',
        scheduled_close_time: '22:00',
        schedule_enabled: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('*')
                .eq('id', '00000000-0000-0000-0000-000000000001')
                .single();

            if (error) {
                logger.warn('Shop status columns may not exist yet', { error });
            } else if (data) {
                const d = data as Record<string, unknown>;
                setSettings({
                    shop_status: (d.shop_status as 'open' | 'closed') || 'open',
                    closed_message: (d.closed_message as string) || 'We are currently closed. Please try again later.',
                    scheduled_open_time: formatTimeForInput(d.scheduled_open_time as string),
                    scheduled_close_time: formatTimeForInput(d.scheduled_close_time as string),
                    schedule_enabled: (d.schedule_enabled as boolean) || false
                });
            }
        } catch (e) {
            logger.error('Error fetching shop settings', { error: e });
        } finally {
            setLoading(false);
        }
    };

    // Convert DB time format to input format
    const formatTimeForInput = (time: string | null | undefined): string => {
        if (!time) return '08:00';
        // If it's already in HH:MM format, return as-is
        if (/^\d{2}:\d{2}$/.test(time)) return time;
        // If it's HH:MM:SS format, strip seconds
        if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.slice(0, 5);
        return '08:00';
    };

    const handleToggle = async () => {
        const newStatus = settings.shop_status === 'open' ? 'closed' : 'open';
        setSaving(true);

        try {
            const { error } = await supabase
                .from('admin_settings')
                .update({ shop_status: newStatus } as any)
                .eq('id', '00000000-0000-0000-0000-000000000001');

            if (error) {
                toast.error('Failed to update shop status');
                logger.error('Error updating shop status', { error });
            } else {
                setSettings(prev => ({ ...prev, shop_status: newStatus }));
                toast.success(`Shop is now ${newStatus === 'open' ? 'OPEN' : 'CLOSED'}`);
            }
        } catch (e) {
            toast.error('Failed to update shop status');
        } finally {
            setSaving(false);
        }
    };

    const handleMessageSave = async () => {
        setSaving(true);

        try {
            const { error } = await supabase
                .from('admin_settings')
                .update({ closed_message: settings.closed_message } as any)
                .eq('id', '00000000-0000-0000-0000-000000000001');

            if (error) {
                toast.error('Failed to save message');
            } else {
                toast.success('Closed message saved');
            }
        } catch (e) {
            toast.error('Failed to save message');
        } finally {
            setSaving(false);
        }
    };

    const handleScheduleSave = async () => {
        setSaving(true);

        try {
            const { error } = await supabase
                .from('admin_settings')
                .update({
                    scheduled_open_time: settings.scheduled_open_time + ':00',
                    scheduled_close_time: settings.scheduled_close_time + ':00',
                    schedule_enabled: settings.schedule_enabled
                } as any)
                .eq('id', '00000000-0000-0000-0000-000000000001');

            if (error) {
                toast.error('Failed to save schedule');
                logger.error('Error saving schedule', { error });
            } else {
                toast.success('Schedule saved');
            }
        } catch (e) {
            toast.error('Failed to save schedule');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8 flex justify-center">
                    <div className="animate-pulse text-muted-foreground">Loading...</div>
                </CardContent>
            </Card>
        );
    }

    const isOpen = settings.shop_status === 'open';

    return (
        <Card className={`border-2 ${isOpen ? 'border-green-500/50' : 'border-red-500/50'}`}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                    <Store className={`h-5 w-5 ${isOpen ? 'text-green-500' : 'text-red-500'}`} />
                    Shop Status
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Status Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <div>
                            <p className="font-semibold">
                                Shop is {isOpen ? 'OPEN' : 'CLOSED'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {isOpen
                                    ? 'Accepting orders (assigned when delivery available)'
                                    : 'Not accepting new orders'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={isOpen}
                        onCheckedChange={handleToggle}
                        disabled={saving}
                    />
                </div>

                {/* Closed Message */}
                {!isOpen && (
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Message shown to customers
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                value={settings.closed_message}
                                onChange={(e) => setSettings(prev => ({ ...prev, closed_message: e.target.value }))}
                                placeholder="We are currently closed..."
                            />
                            <Button onClick={handleMessageSave} disabled={saving} size="sm">
                                Save
                            </Button>
                        </div>
                    </div>
                )}

                {/* Schedule Section */}
                <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 font-medium">
                            <Calendar className="h-4 w-4" />
                            Automatic Schedule
                        </Label>
                        <Switch
                            checked={settings.schedule_enabled}
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, schedule_enabled: checked }))}
                            disabled={saving}
                        />
                    </div>

                    {settings.schedule_enabled && (
                        <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Opens at</Label>
                                    <Input
                                        type="time"
                                        value={settings.scheduled_open_time}
                                        onChange={(e) => setSettings(prev => ({ ...prev, scheduled_open_time: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Closes at</Label>
                                    <Input
                                        type="time"
                                        value={settings.scheduled_close_time}
                                        onChange={(e) => setSettings(prev => ({ ...prev, scheduled_close_time: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <Button onClick={handleScheduleSave} disabled={saving} size="sm" className="w-full">
                                Save Schedule
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Shop will automatically open/close based on this schedule.
                            </p>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="text-xs text-muted-foreground flex items-start gap-2">
                    <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>
                        When shop is open, orders are accepted even if no delivery partner is active.
                        They will be automatically assigned when a delivery partner activates.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
