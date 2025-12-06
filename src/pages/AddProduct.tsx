import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Plus, ArrowLeft, Save, ImagePlus } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';

interface Category {
    id: string;
    name: string;
}

export default function AddProduct() {
    const { user, userRole, loading } = useAuth();
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [saving, setSaving] = useState(false);
    const [productForm, setProductForm] = useState({
        name: '',
        description: '',
        price: '',
        stock_quantity: '',
        unit: 'piece',
        category_id: '',
        image_url: ''
    });

    useEffect(() => {
        if (loading) return;

        if (!user) {
            navigate('/auth');
            return;
        }

        if (userRole === null) return;

        if (userRole !== 'admin' && userRole !== 'super_admin') {
            navigate('/shop');
            return;
        }

        fetchCategories();
    }, [user, userRole, loading, navigate]);

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('id, name').order('name');
        if (data) setCategories(data);
    };

    const handleSaveProduct = async () => {
        if (!productForm.name || !productForm.price || !productForm.category_id) {
            toast.error('Please fill all required fields');
            return;
        }

        setSaving(true);

        const productData = {
            name: productForm.name,
            description: productForm.description || null,
            price: parseFloat(productForm.price),
            stock_quantity: parseInt(productForm.stock_quantity) || 0,
            unit: productForm.unit,
            category_id: productForm.category_id,
            image_url: productForm.image_url || null,
            is_active: true
        };

        const { error } = await supabase.from('products').insert(productData);

        if (error) {
            toast.error('Failed to create product');
        } else {
            toast.success('Product created successfully!');
            navigate('/admin');
        }

        setSaving(false);
    };

    if (loading || userRole === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-md" />
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 max-w-2xl">
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                        <CardContent className="space-y-5">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            ))}
                            <Skeleton className="h-12 w-full" />
                        </CardContent>
                    </Card>
                </main>
                <AdminBottomNav />
            </div>
        );
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                <Plus className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">Add Product</h1>
                                <p className="text-xs text-muted-foreground">Create new product</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 max-w-2xl">
                <Card className="border-primary/20 shadow-xl bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Package className="h-5 w-5 text-primary" />
                            Product Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Product Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">
                                Product Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={productForm.name}
                                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                placeholder="Enter product name"
                                className="h-12"
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <Label htmlFor="category" className="text-sm font-medium">
                                Category <span className="text-destructive">*</span>
                            </Label>
                            <Select value={productForm.category_id} onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Price and Stock Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="price" className="text-sm font-medium">
                                    Price (₹) <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="price"
                                    type="number"
                                    value={productForm.price}
                                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                                    placeholder="0"
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stock" className="text-sm font-medium">Stock Qty</Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    value={productForm.stock_quantity}
                                    onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                                    placeholder="0"
                                    className="h-12"
                                />
                            </div>
                        </div>

                        {/* Unit */}
                        <div className="space-y-2">
                            <Label htmlFor="unit" className="text-sm font-medium">Unit</Label>
                            <Select value={productForm.unit} onValueChange={(value) => setProductForm({ ...productForm, unit: value })}>
                                <SelectTrigger className="h-12">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="piece">Piece</SelectItem>
                                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                                    <SelectItem value="g">Gram (g)</SelectItem>
                                    <SelectItem value="ltr">Litre (ltr)</SelectItem>
                                    <SelectItem value="ml">Millilitre (ml)</SelectItem>
                                    <SelectItem value="pack">Pack</SelectItem>
                                    <SelectItem value="box">Box</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Image URL */}
                        <div className="space-y-2">
                            <Label htmlFor="image" className="text-sm font-medium flex items-center gap-2">
                                <ImagePlus className="h-4 w-4" />
                                Image URL
                            </Label>
                            <Input
                                id="image"
                                value={productForm.image_url}
                                onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                                placeholder="https://example.com/image.jpg"
                                className="h-12"
                            />
                            {productForm.image_url && (
                                <div className="mt-2 rounded-xl overflow-hidden border border-border/50 bg-muted/50">
                                    <img
                                        src={productForm.image_url}
                                        alt="Preview"
                                        className="w-full h-40 object-cover"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                            <Textarea
                                id="description"
                                value={productForm.description}
                                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                                placeholder="Product description..."
                                rows={3}
                                className="resize-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <Button
                            onClick={handleSaveProduct}
                            disabled={saving}
                            className="w-full h-12 text-base font-semibold shadow-lg"
                            size="lg"
                        >
                            {saving ? (
                                <>
                                    <Package className="h-5 w-5 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5 mr-2" />
                                    Create Product
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </main>

            <AdminBottomNav />
        </div>
    );
}
