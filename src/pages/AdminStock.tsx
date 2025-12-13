import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    Filter,
    ArrowUpRight
} from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && (!user || (userRole !== 'admin' && userRole !== 'super_admin'))) {
            navigate('/auth');
        } else if (user) {
            fetchData();
        }
    }, [user, userRole, authLoading, navigate]);

    const fetchData = async () => {
        setIsLoading(true);
        const [prodRes, catRes] = await Promise.all([
            supabase.from('products').select('*').order('stock_quantity', { ascending: true }),
            supabase.from('categories').select('id, name').order('name')
        ]);

        if (prodRes.data) setProducts(prodRes.data as unknown as Product[]);
        if (catRes.data) setCategories(catRes.data);
        setIsLoading(false);
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
            // Revert on error
            fetchData();
        }

        setSavingIds(prev => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
        });
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;

        let matchesStatus = true;
        if (filterStatus === 'low') matchesStatus = product.stock_quantity > 0 && product.stock_quantity <= 10;
        if (filterStatus === 'out') matchesStatus = product.stock_quantity === 0;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    return (
        <AdminLayout title="Stock Management">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 sticky top-20 z-20 bg-slate-50/95 dark:bg-slate-900/95 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[140px] bg-white dark:bg-slate-800">
                            <Filter className="w-3.5 h-3.5 mr-2" />
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)} className="w-[240px]">
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="low" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">Low</TabsTrigger>
                            <TabsTrigger value="out" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700">Out</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {isLoading ? (
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <Card key={i} className="border-0 shadow-sm bg-white/50">
                            <CardContent className="p-4"><Skeleton className="h-32 w-full rounded-xl" /></CardContent>
                        </Card>
                    ))
                ) : filteredProducts.map((product) => (
                    <Card key={product.id} className="overflow-hidden border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-900 group">
                        <div className="relative h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            ) : (
                                <Package className="w-12 h-12 text-slate-300" />
                            )}

                            {/* Stock Badge Overlay */}
                            <div className="absolute top-2 right-2 flex gap-1">
                                {product.stock_quantity === 0 ? (
                                    <Badge variant="destructive" className="shadow-lg animate-pulse">Out of Stock</Badge>
                                ) : product.stock_quantity <= 10 ? (
                                    <Badge className="bg-amber-500 hover:bg-amber-600 shadow-lg text-white">Low Stock: {product.stock_quantity}</Badge>
                                ) : null}
                            </div>
                        </div>

                        <CardContent className="p-4">
                            <div className="mb-4">
                                <h3 className="font-semibold text-slate-900 dark:text-white truncate" title={product.name}>{product.name}</h3>
                                <p className="text-sm text-slate-500">{categories.find(c => c.id === product.category_id)?.name || 'Uncategorized'}</p>
                            </div>

                            <div className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Stock:</span>

                                <div className="flex items-center gap-3">
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8 rounded-full border-slate-200 hover:bg-slate-100 hover:text-red-500 transition-colors"
                                        onClick={() => handleStockUpdate(product.id, product.stock_quantity - 1)}
                                        disabled={product.stock_quantity <= 0 || savingIds.has(product.id)}
                                    >
                                        <Minus className="w-3 h-3" />
                                    </Button>

                                    <span className={`w-12 text-center font-bold text-lg ${product.stock_quantity === 0 ? 'text-red-500' :
                                            product.stock_quantity <= 10 ? 'text-amber-500' :
                                                'text-emerald-600'
                                        }`}>
                                        {savingIds.has(product.id) ? (
                                            <RefreshCw className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                                        ) : product.stock_quantity}
                                    </span>

                                    <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8 rounded-full border-slate-200 hover:bg-slate-100 hover:text-emerald-500 transition-colors"
                                        onClick={() => handleStockUpdate(product.id, product.stock_quantity + 1)}
                                        disabled={savingIds.has(product.id)}
                                    >
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!isLoading && filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Package className="w-16 h-16 mb-4 opacity-20" />
                    <p>No products found matching your filters.</p>
                </div>
            )}
        </AdminLayout>
    );
}
