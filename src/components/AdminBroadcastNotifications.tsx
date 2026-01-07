import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Bell,
    Send,
    Users,
    Truck,
    Shield,
    User,
    Megaphone,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    Zap,
    Gift,
    AlertTriangle,
    TrendingUp,
    Package,
    History,
    Target,
    Sparkles,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BroadcastNotification {
    id: string;
    title: string;
    body: string;
    url: string | null;
    target_audience: string;
    status: string | null;
    sent_count: number | null;
    failed_count: number | null;
    created_at: string | null;
    sent_at: string | null;
}

interface NotificationStats {
    total_sent: number;
    total_failed: number;
    by_type: Record<string, number>;
}

interface NotificationLogEntry {
    notification_type: string;
    status: string;
}

const NOTIFICATION_TEMPLATES = [
    {
        id: 'flash_sale',
        name: '⚡ Flash Sale',
        title: '⚡ Flash Sale Live!',
        body: 'Hurry! Up to 50% off on selected items. Limited time only!',
        icon: 'zap',
        url: '/shop'
    },
    {
        id: 'new_arrival',
        name: '🆕 New Arrival',
        title: '🆕 Fresh Arrivals!',
        body: 'New products just landed! Check out the latest additions.',
        icon: 'sparkles',
        url: '/shop'
    },
    {
        id: 'festive_offer',
        name: '🎉 Festive Offer',
        title: '🎉 Festive Special!',
        body: 'Celebrate with special discounts. Shop now!',
        icon: 'gift',
        url: '/shop'
    },
    {
        id: 'urgent_update',
        name: '🚨 Urgent Update',
        title: '🚨 Important Notice',
        body: 'Please read this important update regarding your orders.',
        icon: 'alert-triangle',
        url: '/'
    },
    {
        id: 'delivery_update',
        name: '🚚 Delivery Update',
        title: '🚚 Delivery Update',
        body: 'Important information about deliveries in your area.',
        icon: 'truck',
        url: '/orders'
    },
    {
        id: 'custom',
        name: '✏️ Custom Message',
        title: '',
        body: '',
        icon: 'bell',
        url: '/'
    },
];

const AUDIENCE_OPTIONS = [
    { value: 'all', label: 'All Users', icon: Users, color: 'bg-blue-500' },
    { value: 'users', label: 'Customers Only', icon: User, color: 'bg-green-500' },
    { value: 'admins', label: 'Admins Only', icon: Shield, color: 'bg-purple-500' },
    { value: 'delivery', label: 'Delivery Partners', icon: Truck, color: 'bg-orange-500' },
];

export function AdminBroadcastNotifications() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [broadcasts, setBroadcasts] = useState<BroadcastNotification[]>([]);
    const [stats, setStats] = useState<NotificationStats | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Form state
    const [selectedTemplate, setSelectedTemplate] = useState('custom');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('/');
    const [targetAudience, setTargetAudience] = useState('all');
    const [scheduleNotification, setScheduleNotification] = useState(false);
    const [scheduledTime, setScheduledTime] = useState('');

    useEffect(() => {
        fetchBroadcasts();
        fetchStats();
    }, []);

    const fetchBroadcasts = async () => {
        const { data, error } = await supabase
            .from('broadcast_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (data && !error) {
            setBroadcasts(data);
        }
    };

    const fetchStats = async () => {
        const { data, error } = await supabase
            .from('notification_logs')
            .select('notification_type, status')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (data && !error) {
            const logs = data as NotificationLogEntry[];
            const total_sent = logs.filter(n => n.status === 'sent').length;
            const total_failed = logs.filter(n => n.status === 'failed').length;
            const by_type: Record<string, number> = {};
            logs.forEach(n => {
                by_type[n.notification_type] = (by_type[n.notification_type] || 0) + 1;
            });
            setStats({ total_sent, total_failed, by_type });
        }
    };

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplate(templateId);
        const template = NOTIFICATION_TEMPLATES.find(t => t.id === templateId);
        if (template && templateId !== 'custom') {
            setTitle(template.title);
            setBody(template.body);
            setUrl(template.url);
        }
    };

    const sendBroadcast = async () => {
        if (!title.trim() || !body.trim()) {
            toast.error('Please enter title and message');
            return;
        }

        setLoading(true);
        setShowConfirmDialog(false);

        try {
            // Create broadcast record
            const { data: broadcast, error: insertError } = await supabase
                .from('broadcast_notifications')
                .insert({
                    title,
                    body,
                    url,
                    target_audience: targetAudience,
                    send_immediately: !scheduleNotification,
                    scheduled_at: scheduleNotification ? scheduledTime : null,
                    status: scheduleNotification ? 'scheduled' : 'sending',
                    created_by: user?.id,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            if (!scheduleNotification) {
                // Send immediately via Edge Function
                const { data, error } = await supabase.functions.invoke('send-push-notification', {
                    body: {
                        title,
                        body,
                        url,
                        notification_type: 'broadcast',
                        broadcast_id: broadcast.id,
                        send_to_admins: targetAudience === 'admins',
                        send_to_delivery: targetAudience === 'delivery',
                        preference_filter: targetAudience === 'all' ? 'promotional_alerts' : null,
                    },
                });

                if (error) throw error;

                toast.success(`🚀 Broadcast sent to ${data.sent} users!`);
            } else {
                toast.success('📅 Broadcast scheduled successfully!');
            }

            // Reset form
            setTitle('');
            setBody('');
            setUrl('/');
            setSelectedTemplate('custom');
            fetchBroadcasts();
            fetchStats();

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error sending broadcast', { error: errorMessage });
            toast.error('Failed to send broadcast: ' + errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const sendTestNotification = async (type: string) => {
        setSendingTest(true);

        try {
            let testPayload: any = { notification_type: type };

            switch (type) {
                case 'profit_summary':
                    testPayload = {
                        ...testPayload,
                        title: '💰 Daily Profit Summary',
                        body: 'Today: ₹12,500 revenue, ₹3,200 profit from 45 orders!',
                        url: '/admin',
                        send_to_admins: true,
                    };
                    break;
                case 'order_status':
                    testPayload = {
                        ...testPayload,
                        title: '🛒 New Order #ABC123',
                        body: 'New order worth ₹450 from Test Customer',
                        url: '/admin',
                        send_to_admins: true,
                    };
                    break;
                case 'low_stock':
                    testPayload = {
                        ...testPayload,
                        title: '⚠️ Low Stock Alert',
                        body: 'Fresh Tomatoes is running low! Only 3 units left.',
                        url: '/admin/stock',
                        send_to_admins: true,
                    };
                    break;
                case 'daily_reminder':
                    testPayload = {
                        ...testPayload,
                        title: '☀️ Good Morning!',
                        body: 'Time to check your shop! 5 pending orders waiting.',
                        url: '/admin',
                        user_ids: [user?.id],
                    };
                    break;
            }

            const { data, error } = await supabase.functions.invoke('send-push-notification', {
                body: testPayload,
            });

            if (error) throw error;

            toast.success(`✅ Test ${type} notification sent!`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to send test: ' + errorMessage);
        } finally {
            setSendingTest(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sent':
                return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
            case 'sending':
                return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Sending</Badge>;
            case 'scheduled':
                return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
            case 'failed':
                return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getAudienceIcon = (audience: string) => {
        const option = AUDIENCE_OPTIONS.find(a => a.value === audience);
        if (option) {
            const Icon = option.icon;
            return <Icon className="h-4 w-4" />;
        }
        return <Users className="h-4 w-4" />;
    };

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/40 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 dark:text-green-400">Sent (7d)</p>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                    {stats?.total_sent || 0}
                                </p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950/40 dark:to-rose-900/20 border-red-200 dark:border-red-800">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-600 dark:text-red-400">Failed (7d)</p>
                                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                                    {stats?.total_failed || 0}
                                </p>
                            </div>
                            <XCircle className="h-8 w-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 dark:text-blue-400">Order Alerts</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                    {stats?.by_type?.order_status || 0}
                                </p>
                            </div>
                            <Package className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/40 dark:to-violet-900/20 border-purple-200 dark:border-purple-800">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-600 dark:text-purple-400">Broadcasts</p>
                                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                                    {broadcasts.filter(b => b.status === 'sent').length}
                                </p>
                            </div>
                            <Megaphone className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="broadcast" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="broadcast" className="gap-2">
                        <Megaphone className="h-4 w-4" />
                        <span className="hidden sm:inline">Broadcast</span>
                    </TabsTrigger>
                    <TabsTrigger value="test" className="gap-2">
                        <Zap className="h-4 w-4" />
                        <span className="hidden sm:inline">Test</span>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="h-4 w-4" />
                        <span className="hidden sm:inline">History</span>
                    </TabsTrigger>
                </TabsList>

                {/* Broadcast Tab */}
                <TabsContent value="broadcast" className="space-y-6">
                    <Card>
                        <CardHeader className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10">
                            <CardTitle className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                                    <Megaphone className="h-5 w-5 text-white" />
                                </div>
                                Send Broadcast Notification
                            </CardTitle>
                            <CardDescription>
                                Send instant notifications to users, admins, or delivery partners
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {/* Template Selection */}
                            <div className="space-y-2">
                                <Label>Quick Templates</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {NOTIFICATION_TEMPLATES.map((template) => (
                                        <Button
                                            key={template.id}
                                            variant={selectedTemplate === template.id ? 'default' : 'outline'}
                                            className={`justify-start h-auto py-3 ${selectedTemplate === template.id
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-600 border-0'
                                                : ''
                                                }`}
                                            onClick={() => handleTemplateChange(template.id)}
                                        >
                                            <span className="text-sm">{template.name}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Title & Body */}
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Notification Title *</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g., ⚡ Flash Sale Live!"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="text-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="body">Message *</Label>
                                    <Textarea
                                        id="body"
                                        placeholder="Enter your notification message..."
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        rows={3}
                                    />
                                    <p className="text-xs text-muted-foreground">{body.length}/200 characters recommended</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="url">Target Page URL</Label>
                                    <Input
                                        id="url"
                                        placeholder="/shop or /orders/abc123"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Where users go when they tap the notification</p>
                                </div>
                            </div>

                            {/* Target Audience */}
                            <div className="space-y-3">
                                <Label>Target Audience</Label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {AUDIENCE_OPTIONS.map((option) => {
                                        const Icon = option.icon;
                                        return (
                                            <Button
                                                key={option.value}
                                                variant={targetAudience === option.value ? 'default' : 'outline'}
                                                className={`flex-col h-auto py-4 gap-2 ${targetAudience === option.value ? option.color + ' border-0 text-white' : ''
                                                    }`}
                                                onClick={() => setTargetAudience(option.value)}
                                            >
                                                <Icon className="h-6 w-6" />
                                                <span className="text-xs">{option.label}</span>
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Schedule Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Schedule for later</p>
                                        <p className="text-sm text-muted-foreground">Set a specific time to send</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={scheduleNotification}
                                    onCheckedChange={setScheduleNotification}
                                />
                            </div>

                            {scheduleNotification && (
                                <div className="space-y-2">
                                    <Label>Scheduled Time</Label>
                                    <Input
                                        type="datetime-local"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        min={new Date().toISOString().slice(0, 16)}
                                    />
                                </div>
                            )}

                            {/* Preview */}
                            {title && (
                                <div className="space-y-2">
                                    <Label>Preview</Label>
                                    <div className="p-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                                                <Bell className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold truncate">{title}</p>
                                                <p className="text-sm text-gray-300 line-clamp-2">{body}</p>
                                                <p className="text-xs text-gray-500 mt-1">PremasShop • now</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Send Button */}
                            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                                <DialogTrigger asChild>
                                    <Button
                                        className="w-full h-12 text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600"
                                        disabled={!title.trim() || !body.trim() || loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-5 w-5 mr-2" />
                                                {scheduleNotification ? 'Schedule Broadcast' : 'Send Broadcast Now'}
                                            </>
                                        )}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                            Confirm Broadcast
                                        </DialogTitle>
                                        <DialogDescription>
                                            You are about to send a notification to <strong>{
                                                AUDIENCE_OPTIONS.find(a => a.value === targetAudience)?.label
                                            }</strong>. This action cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                                        <p className="font-semibold">{title}</p>
                                        <p className="text-sm text-muted-foreground">{body}</p>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            className="bg-gradient-to-r from-purple-500 to-pink-600"
                                            onClick={sendBroadcast}
                                            disabled={loading}
                                        >
                                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                            Confirm & Send
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Test Notifications Tab */}
                <TabsContent value="test" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-500" />
                                Test Notifications
                            </CardTitle>
                            <CardDescription>
                                Send test notifications to verify each type is working correctly
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Profit Summary Test */}
                                <Card className="border-green-200 dark:border-green-800">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">Profit Summary</p>
                                                    <p className="text-xs text-muted-foreground">Daily earnings report</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => sendTestNotification('profit_summary')}
                                                disabled={sendingTest}
                                            >
                                                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Order Update Test */}
                                <Card className="border-blue-200 dark:border-blue-800">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                                    <Package className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">Order Update</p>
                                                    <p className="text-xs text-muted-foreground">New order alert</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => sendTestNotification('order_status')}
                                                disabled={sendingTest}
                                            >
                                                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Low Stock Test */}
                                <Card className="border-orange-200 dark:border-orange-800">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                                                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">Low Stock Alert</p>
                                                    <p className="text-xs text-muted-foreground">Inventory warning</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => sendTestNotification('low_stock')}
                                                disabled={sendingTest}
                                            >
                                                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Daily Reminder Test */}
                                <Card className="border-purple-200 dark:border-purple-800">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                                    <Clock className="h-5 w-5 text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">Daily Reminder</p>
                                                    <p className="text-xs text-muted-foreground">Morning check-in</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => sendTestNotification('daily_reminder')}
                                                disabled={sendingTest}
                                            >
                                                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Broadcast History
                                </CardTitle>
                                <CardDescription>Recent broadcast notifications</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchBroadcasts}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {broadcasts.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No broadcasts sent yet</p>
                                    <p className="text-sm">Your broadcast history will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {broadcasts.map((broadcast) => (
                                        <div
                                            key={broadcast.id}
                                            className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                                                {getAudienceIcon(broadcast.target_audience)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-medium truncate">{broadcast.title}</p>
                                                        <p className="text-sm text-muted-foreground line-clamp-1">{broadcast.body}</p>
                                                    </div>
                                                    {getStatusBadge(broadcast.status || 'unknown')}
                                                </div>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Target className="h-3 w-3" />
                                                        {AUDIENCE_OPTIONS.find(a => a.value === broadcast.target_audience)?.label}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                                        {broadcast.sent_count} sent
                                                    </span>
                                                    {(broadcast.failed_count || 0) > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <XCircle className="h-3 w-3 text-red-500" />
                                                            {broadcast.failed_count} failed
                                                        </span>
                                                    )}
                                                    <span>
                                                        {format(new Date(broadcast.created_at || Date.now()), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default AdminBroadcastNotifications;
