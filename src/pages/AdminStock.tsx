import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Package,
    AlertTriangle,
    CheckCircle,
    Search,
    TrendingDown,
    TrendingUp,
    Boxes,
    RefreshCw,
    Save,
    Plus,
    Minus
} from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';

interface Product {
    id: string;
    name: string;
    price: number;
    stock_quantity: number;
    unit: string;
    image_url: string | null;
    category_id: string | null;
    discount_percent: number | null;
}

interface Category {
    id: string;
    name: string;
}

export default function AdminStock() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out' | 'good'>('all');
    const [editingStock, setEditingStock] = useState<Record<string, number>>({});
    const [editingDiscount, setEditingDiscount] = useState<Record<string, number | null>>({});
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            navigate('/auth');
            return;
        }

        // Wait for userRole to be loaded
        if (userRole === null) return;

        // Redirect non-admins
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            switch (userRole) {
                case 'delivery':
                    navigate('/delivery');
                    break;
                default:
                    navigate('/shop');
                    break;
            }
            return;
        }

        fetchProducts();
        fetchCategories();
    }, [user, userRole, authLoading, navigate]);

    const fetchProducts = async () => {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, price, stock_quantity, unit, image_url, category_id, discount_percent')
            .order('stock_quantity', { ascending: true });

        if (!error && data) {
            setProducts(data as unknown as Product[]);
        }
    };

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('id, name');
        if (data) setCategories(data);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchProducts();
        setIsRefreshing(false);
        toast.success('Stock data refreshed');
    };

    const handleStockChange = (productId: string, value: string) => {
        const numValue = parseInt(value) || 0;
        setEditingStock(prev => ({
            ...prev,
            [productId]: Math.max(0, numValue)
        }));
    };

    const saveStock = async (productId: string) => {
        const newStock = editingStock[productId];
        if (newStock === undefined) return;

        setSavingIds(prev => new Set(prev).add(productId));

        const { error } = await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', productId);

        if (error) {
            toast.error('Failed to update stock');
        } else {
            toast.success('Stock updated successfully');
            setProducts(prev =>
                prev.map(p => p.id === productId ? { ...p, stock_quantity: newStock } : p)
            );
            setEditingStock(prev => {
                const updated = { ...prev };
                delete updated[productId];
                return updated;
            });
        }

        setSavingIds(prev => {
            const updated = new Set(prev);
            updated.delete(productId);
            return updated;
        });
    };

    // Quick +/- stock adjustment (instant update)
    const quickAdjustStock = async (productId: string, delta: number) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const newStock = Math.max(0, product.stock_quantity + delta);

        setSavingIds(prev => new Set(prev).add(productId));

        const { error } = await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', productId);

        if (error) {
            toast.error('Failed to update stock');
        } else {
            setProducts(prev =>
                prev.map(p => p.id === productId ? { ...p, stock_quantity: newStock } : p)
            );
        }

        setSavingIds(prev => {
            const updated = new Set(prev);
            updated.delete(productId);
            return updated;
        });
    };

    const handleDiscountChange = (productId: string, value: string) => {
        if (value === '' || value === '-') {
            setEditingDiscount(prev => ({ ...prev, [productId]: null }));
            return;
        }
        const numValue = parseInt(value) || 0;
        setEditingDiscount(prev => ({
            ...prev,
            [productId]: Math.min(100, Math.max(0, numValue))
        }));
    };

    const saveDiscount = async (productId: string) => {
        const newDiscount = editingDiscount[productId];
        if (newDiscount === undefined) return;

        setSavingIds(prev => new Set(prev).add(productId));

        const { error } = await supabase
            .from('products')
            .update({ discount_percent: newDiscount } as any)
            .eq('id', productId);

        if (error) {
            toast.error('Failed to update discount');
        } else {
            toast.success(newDiscount ? `${newDiscount}% discount applied!` : 'Discount removed');
            setProducts(prev =>
                prev.map(p => p.id === productId ? { ...p, discount_percent: newDiscount } : p)
            );
            setEditingDiscount(prev => {
                const updated = { ...prev };
                delete updated[productId];
                return updated;
            });
        }

        setSavingIds(prev => {
            const updated = new Set(prev);
            updated.delete(productId);
            return updated;
        });
    };

    const getCategoryName = (categoryId: string | null) => {
        if (!categoryId) return 'Uncategorized';
        const category = categories.find(c => c.id === categoryId);
        return category?.name || 'Unknown';
    };

    const getStockStatus = (stock: number) => {
        if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400' };
        if (stock <= 5) return { label: 'Critical', color: 'bg-red-400', textColor: 'text-red-600 dark:text-red-400' };
        if (stock <= 10) return { label: 'Low Stock', color: 'bg-orange-400', textColor: 'text-orange-600 dark:text-orange-400' };
        if (stock <= 25) return { label: 'Medium', color: 'bg-yellow-400', textColor: 'text-yellow-600 dark:text-yellow-400' };
        return { label: 'In Stock', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' };
    };

    // Stats calculations
    const stats = {
        total: products.length,
        outOfStock: products.filter(p => p.stock_quantity === 0).length,
        lowStock: products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 10).length,
        goodStock: products.filter(p => p.stock_quantity > 10).length,
        totalUnits: products.reduce((sum, p) => sum + p.stock_quantity, 0)
    };

    // Filtered products
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        switch (filterStatus) {
            case 'out':
                return product.stock_quantity === 0;
            case 'low':
                return product.stock_quantity > 0 && product.stock_quantity <= 10;
            case 'good':
                return product.stock_quantity > 10;
            default:
                return true;
        }
    });

    // Show loading while checking auth
    if (authLoading || userRole === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-xl" />
                                <Skeleton className="h-7 w-48" />
                            </div>
                            <Skeleton className="h-10 w-10 rounded-md" />
                        </div>
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 pb-24 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-24 rounded-xl" />
                        ))}
                    </div>
                    <div className="flex gap-4">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-20 w-full rounded-xl" />
                        ))}
                    </div>
                </main>
                <AdminBottomNav />
            </div>
        );
    }

    // Don't render if not admin
    if (userRole !== 'admin' && userRole !== 'super_admin') {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-28">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                <Boxes className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">Stock Management</h1>
                                <p className="text-xs text-muted-foreground">Manage your inventory levels</p>
                            </div>
                        </div>
                        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing} className="bg-background/60">
                            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 pb-24">
                {/* Stats Carousel on Mobile, Grid on Desktop */}
                <div className="flex overflow-x-auto pb-6 -mx-4 px-4 gap-4 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-5 md:overflow-visible md:pb-0 md:mx-0 md:px-0 mb-6 scrollbar-hide">
                    <Card
                        className={`min-w-[260px] snap-center cursor-pointer transition-all ${filterStatus === 'all' ? 'ring-2 ring-primary' : 'hover:bg-accent/50'}`}
                        onClick={() => setFilterStatus('all')}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">All Products</p>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                </div>
                                <Package className="h-8 w-8 text-primary/40" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className={`min-w-[260px] snap-center cursor-pointer transition-all ${filterStatus === 'out' ? 'ring-2 ring-red-500' : 'hover:bg-red-50 dark:hover:bg-red-950/20'}`}
                        onClick={() => setFilterStatus('out')}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-red-600 dark:text-red-400">Out of Stock</p>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.outOfStock}</p>
                                </div>
                                <AlertTriangle className="h-8 w-8 text-red-400/60" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className={`min-w-[260px] snap-center cursor-pointer transition-all ${filterStatus === 'low' ? 'ring-2 ring-orange-500' : 'hover:bg-orange-50 dark:hover:bg-orange-950/20'}`}
                        onClick={() => setFilterStatus('low')}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-orange-600 dark:text-orange-400">Low Stock</p>
                                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.lowStock}</p>
                                </div>
                                <TrendingDown className="h-8 w-8 text-orange-400/60" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className={`min-w-[260px] snap-center cursor-pointer transition-all ${filterStatus === 'good' ? 'ring-2 ring-green-500' : 'hover:bg-green-50 dark:hover:bg-green-950/20'}`}
                        onClick={() => setFilterStatus('good')}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-green-600 dark:text-green-400">Good Stock</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.goodStock}</p>
                                </div>
                                <CheckCircle className="h-8 w-8 text-green-400/60" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="min-w-[260px] snap-center bg-gradient-to-br from-primary/10 to-primary/5">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-primary">Total Units</p>
                                    <p className="text-2xl font-bold text-primary">{stats.totalUnits.toLocaleString()}</p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-primary/40" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Showing {filteredProducts.length} of {products.length} products
                    </p>
                </div>

                {/* Products List - Mobile-First Card Layout */}
                <div className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                        {filteredProducts.length} Products
                    </h2>

                    {filteredProducts.map((product) => {
                        const status = getStockStatus(product.stock_quantity);
                        const isEditing = editingStock[product.id] !== undefined;
                        const isSaving = savingIds.has(product.id);

                        return (
                            <Card
                                key={product.id}
                                className={`overflow-hidden ${product.stock_quantity === 0
                                    ? 'border-red-300 bg-red-50/30 dark:bg-red-950/20'
                                    : product.stock_quantity <= 10
                                        ? 'border-orange-300 bg-orange-50/30 dark:bg-orange-950/20'
                                        : ''
                                    }`}
                            >
                                <CardContent className="p-3">
                                    <div className="flex gap-3">
                                        {/* Product Image */}
                                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="h-6 w-6 text-muted-foreground" />
                                            )}
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="font-medium text-sm truncate">{product.name}</h3>
                                                    <p className="text-xs text-muted-foreground">₹{product.price} / {product.unit}</p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`${status.textColor} border-current text-xs whitespace-nowrap`}
                                                >
                                                    {status.label}
                                                </Badge>
                                            </div>

                                            {/* Stock Controls */}
                                            <div className="flex items-center justify-between mt-3 gap-2">
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-8 w-8"
                                                        onClick={() => quickAdjustStock(product.id, -1)}
                                                        disabled={isSaving || product.stock_quantity === 0}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={isEditing ? editingStock[product.id] : product.stock_quantity}
                                                        onChange={(e) => handleStockChange(product.id, e.target.value)}
                                                        className="w-16 h-8 text-center text-sm"
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-8 w-8"
                                                        onClick={() => quickAdjustStock(product.id, 1)}
                                                        disabled={isSaving}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Save button - only show when editing */}
                                                {isEditing && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => saveStock(product.id)}
                                                        disabled={isSaving}
                                                        className="h-8"
                                                    >
                                                        {isSaving ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Save className="h-4 w-4 mr-1" />
                                                                Save
                                                            </>
                                                        )}
                                                    </Button>
                                                )}

                                                {/* Discount Badge */}
                                                {product.discount_percent && product.discount_percent > 0 && (
                                                    <Badge className="bg-green-600 text-white text-xs">
                                                        {product.discount_percent}% OFF
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {filteredProducts.length === 0 && (
                        <Card className="py-12">
                            <CardContent className="text-center">
                                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                                <p className="text-muted-foreground">No products found</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>

            {/* Admin Bottom Navigation */}
            <AdminBottomNav />
        </div>
    );
}
