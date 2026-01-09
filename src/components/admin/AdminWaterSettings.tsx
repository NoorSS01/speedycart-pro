/**
 * Admin Water Settings Component
 * 
 * Allows admins to configure the 20L water refill system:
 * - Select which product is the water refill product
 * - Set deposit amount per bottle
 * - View user deposit summary
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Droplets, Save, RefreshCw } from 'lucide-react';
import { ExtendedDatabase } from '@/types/supabase-ext';
import { Database } from '@/integrations/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';

// Cast supabase to include our new tables
const supabaseTyped = supabase as unknown as SupabaseClient<Database & ExtendedDatabase['public']>;

interface Product {
    id: string;
    name: string;
    price: number;
}

interface DepositSummary {
    totalUsers: number;
    totalBottles: number;
    totalDeposits: number;
}

export function AdminWaterSettings() {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [depositAmount, setDepositAmount] = useState<number>(100);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [summary, setSummary] = useState<DepositSummary | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch products (for dropdown)
            const { data: productsData } = await supabase
                .from('products')
                .select('id, name, price')
                .order('name');

            setProducts(productsData || []);

            // Fetch current settings from app_settings table
            // Note: Table may not exist in types yet - regenerate after running SQL
            try {
                const { data: settingsData } = await supabaseTyped
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['water_refill_product_id', 'water_deposit_per_bottle']);

                if (settingsData) {
                    settingsData.forEach((setting: { key: string; value: string }) => {
                        if (setting.key === 'water_refill_product_id') {
                            const value = setting.value;
                            setSelectedProductId(value !== 'null' ? JSON.parse(value) : '');
                        } else if (setting.key === 'water_deposit_per_bottle') {
                            setDepositAmount(parseFloat(setting.value) || 100);
                        }
                    });
                }
            } catch (e) {
                console.log('app_settings table not yet created');
            }

            // Fetch deposit summary from user_water_deposits
            // Note: Table may not exist in types yet - regenerate after running SQL
            try {
                const { data: depositsData } = await supabaseTyped
                    .from('user_water_deposits')
                    .select('bottles_owned, total_deposit_paid');

                if (depositsData) {
                    setSummary({
                        totalUsers: depositsData.length,
                        totalBottles: depositsData.reduce((sum: number, d: { bottles_owned?: number }) => sum + (d.bottles_owned || 0), 0),
                        totalDeposits: depositsData.reduce((sum: number, d: { total_deposit_paid?: number | string }) => sum + parseFloat(String(d.total_deposit_paid || 0)), 0),
                    });
                }
            } catch (e) {
                console.log('user_water_deposits table not yet created');
            }
        } catch (error) {
            console.error('Error fetching water settings:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Update water refill product ID
            // Note: app_settings table may not exist in types yet - regenerate after running SQL
            await supabaseTyped
                .from('app_settings')
                .upsert({
                    key: 'water_refill_product_id',
                    value: selectedProductId ? JSON.stringify(selectedProductId) : 'null',
                    updated_at: new Date().toISOString(),
                });

            // Update deposit amount
            await supabaseTyped
                .from('app_settings')
                .upsert({
                    key: 'water_deposit_per_bottle',
                    value: String(depositAmount),
                    updated_at: new Date().toISOString(),
                });

            toast.success('Water settings saved successfully!');
        } catch (error) {
            console.error('Error saving water settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-blue-500" />
                    Water Refill Settings
                </CardTitle>
                <CardDescription>
                    Configure the 20L water bottle refill deposit system
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Deposit Summary */}
                {summary && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-blue-600">{summary.totalUsers}</p>
                            <p className="text-xs text-muted-foreground">Users with Deposits</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-green-600">{summary.totalBottles}</p>
                            <p className="text-xs text-muted-foreground">Total Bottles</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-amber-600">₹{summary.totalDeposits}</p>
                            <p className="text-xs text-muted-foreground">Total Deposits</p>
                        </div>
                    </div>
                )}

                {/* Product Selection */}
                <div className="space-y-2">
                    <Label>Water Refill Product (20L)</Label>
                    <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full p-2.5 border rounded-md bg-background"
                    >
                        <option value="">Select a product...</option>
                        {products.map(product => (
                            <option key={product.id} value={product.id}>
                                {product.name} - ₹{product.price}
                            </option>
                        ))}
                    </select>
                    {selectedProductId && (
                        <Badge variant="secondary" className="mt-1">
                            Selected: {products.find(p => p.id === selectedProductId)?.name}
                        </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                        This product will require bottle deposits for ordering
                    </p>
                </div>

                {/* Deposit Amount */}
                <div className="space-y-2">
                    <Label>Deposit Per Bottle (₹)</Label>
                    <Input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(parseInt(e.target.value) || 100)}
                        min={1}
                        max={1000}
                    />
                    <p className="text-xs text-muted-foreground">
                        Refundable deposit amount required per 20L bottle
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default AdminWaterSettings;
