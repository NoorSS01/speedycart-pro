import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Package,
    AlertTriangle,
    Search,
    Plus,
    Minus,
    RefreshCw,
    Boxes,
    Edit
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
    const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            navigate('/auth');
            return;
        }

        if (userRole === null) return;

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

        fetchData();
    }, [user, userRole, authLoading, navigate]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [prodRes, catRes] = await Promise.all([
                supabase.from('products').select('*').order('stock_quantity', { ascending: true }),
                supabase.from('categories').select('id, name').order('name')
            ]);

            if (prodRes.data) setProducts(prodRes.data as unknown as Product[]);
            if (catRes.data) setCategories(catRes.data);
        } catch (error) {
            toast.error('Failed to load products');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStockUpdate = async (productId: string, newQuantity: number) => {
        if (newQuantity < 0) return;
        setSavingIds(prev => new Set(prev).add(productId));

        // Optimistic update
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock_quantity: newQuantity } : p));

        const { error } = await supabase
            .from('products')
            .update({ stock_quantity: newQuantity })
            .eq('id', productId);

        if (error) {
            toast.error('Failed to update stock');
            fetchData(); // Revert
        }

        setSavingIds(prev => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
        });
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
        let matchesStatus = true;
        if (filterStatus === 'low') matchesStatus = product.stock_quantity > 0 && product.stock_quantity <= 10;
        if (filterStatus === 'out') matchesStatus = product.stock_quantity === 0;
        return matchesSearch && matchesStatus;
    });

    const lowStockCount = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 10).length;
    const outOfStockCount = products.filter(p => p.stock_quantity === 0).length;

    if (authLoading || userRole === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
                    <div className="container mx-auto px-4 py-4">
                        <Skeleton className="h-8 w-48" />
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </main>
                <AdminBottomNav />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                            <Boxes className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Stock Management</h1>
                            <p className="text-xs text-muted-foreground">Manage product inventory</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`p-3 rounded-xl text-center transition-all ${filterStatus === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                    >
                        <p className="text-lg font-bold">{products.length}</p>
                        <p className="text-xs">All</p>
                    </button>
                    <button
                        onClick={() => setFilterStatus('low')}
                        className={`p-3 rounded-xl text-center transition-all ${filterStatus === 'low' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700'}`}
                    >
                        <p className="text-lg font-bold">{lowStockCount}</p>
                        <p className="text-xs">Low Stock</p>
                    </button>
                    <button
                        onClick={() => setFilterStatus('out')}
                        className={`p-3 rounded-xl text-center transition-all ${filterStatus === 'out' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700'}`}
                    >
                        <p className="text-lg font-bold">{outOfStockCount}</p>
                        <p className="text-xs">Out</p>
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Product List */}
                {isLoading ? (
                    [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No products found</p>
                    </div>
                ) : (
                    filteredProducts.map(product => (
                        <Card key={product.id} className="overflow-hidden">
                            <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                    {/* Image */}
                                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Package className="w-6 h-6 text-muted-foreground" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{product.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {product.stock_quantity === 0 ? (
                                                <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                                            ) : product.stock_quantity <= 10 ? (
                                                <Badge className="bg-amber-500 text-[10px]">Low: {product.stock_quantity}</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                                                    In Stock: {product.stock_quantity}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Edit & Stock Controls */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => navigate(`/admin/add-product?id=${product.id}`)}
                                            title="Edit Product"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="h-8 w-8 rounded-full"
                                                onClick={() => handleStockUpdate(product.id, product.stock_quantity - 1)}
                                                disabled={product.stock_quantity <= 0 || savingIds.has(product.id)}
                                            >
                                                <Minus className="w-3 h-3" />
                                            </Button>

                                            <span className={`w-10 text-center font-bold text-sm ${product.stock_quantity === 0 ? 'text-red-500' :
                                                product.stock_quantity <= 10 ? 'text-amber-500' :
                                                    'text-emerald-600'
                                                }`}>
                                                {savingIds.has(product.id) ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                                                ) : product.stock_quantity}
                                            </span>

                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="h-8 w-8 rounded-full"
                                                onClick={() => handleStockUpdate(product.id, product.stock_quantity + 1)}
                                                disabled={savingIds.has(product.id)}
                                            >
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </main>

            <AdminBottomNav />
        </div>
    );
}
