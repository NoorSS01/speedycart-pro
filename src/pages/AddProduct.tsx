import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Plus, ArrowLeft, Save, ImagePlus, Edit, Trash2 } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';

interface Category {
    id: string;
    name: string;
}

interface ProductVariant {
    id?: string;
    variant_name: string;
    variant_value: string;
    variant_unit: string;
    price: string;
    mrp: string;
    is_default: boolean;
}

const UNIT_OPTIONS = [
    { value: 'piece', label: 'Piece' },
    { value: 'pieces', label: 'Pieces' },
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'g', label: 'Gram (g)' },
    { value: 'ltr', label: 'Litre (ltr)' },
    { value: 'ml', label: 'Millilitre (ml)' },
    { value: 'pack', label: 'Pack' },
    { value: 'box', label: 'Box' },
    { value: 'dozen', label: 'Dozen' },
    { value: 'pair', label: 'Pair' },
    { value: 'unit', label: 'Unit' },
    { value: 'serving', label: 'Serving' }
];

export default function AddProduct() {
    const { user, userRole, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');
    const isEditing = !!editId;

    const [categories, setCategories] = useState<Category[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [productForm, setProductForm] = useState({
        name: '',
        description: '',
        price: '',
        mrp: '',
        stock_quantity: '',
        unit: 'piece',
        category_id: '',
        image_url: ''
    });
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [additionalImages, setAdditionalImages] = useState<string[]>([]);
    const [newImageUrl, setNewImageUrl] = useState('');

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

        // If editing, fetch the product
        if (isEditing && editId) {
            fetchProduct(editId);
        }
    }, [user, userRole, loading, navigate, isEditing, editId]);

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('id, name').order('name');
        if (data) setCategories(data);
    };

    const fetchProduct = async (productId: string) => {
        setLoadingProduct(true);

        // Fetch product
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            toast.error('Failed to load product');
            navigate('/admin');
            return;
        }

        setProductForm({
            name: product.name || '',
            description: product.description || '',
            price: product.price?.toString() || '',
            mrp: product.mrp?.toString() || '',
            stock_quantity: product.stock_quantity?.toString() || '',
            unit: product.unit || 'piece',
            category_id: product.category_id || '',
            image_url: product.image_url || ''
        });

        // Fetch variants
        const { data: variantsData } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', productId)
            .order('display_order');

        if (variantsData && variantsData.length > 0) {
            setVariants(variantsData.map(v => ({
                id: v.id,
                variant_name: v.variant_name,
                variant_value: v.variant_value?.toString() || '',
                variant_unit: v.variant_unit,
                price: v.price?.toString() || '',
                mrp: v.mrp?.toString() || '',
                is_default: v.is_default || false
            })));
        }

        // Fetch additional images
        try {
            const { data: imagesData } = await (supabase as any)
                .from('product_images')
                .select('image_url')
                .eq('product_id', productId)
                .order('display_order');

            if (imagesData && imagesData.length > 0) {
                setAdditionalImages(imagesData.map((img: any) => img.image_url));
            }
        } catch (e) {
            console.log('Product images table may not exist yet');
        }

        setLoadingProduct(false);
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
            mrp: productForm.mrp ? parseFloat(productForm.mrp) : null,
            stock_quantity: parseInt(productForm.stock_quantity) || 0,
            unit: productForm.unit,
            category_id: productForm.category_id,
            image_url: productForm.image_url || null,
            is_active: true
        };

        let productId = editId;

        if (isEditing && editId) {
            // Update existing product
            const { error } = await supabase.from('products').update(productData).eq('id', editId);
            if (error) {
                toast.error('Failed to update product');
                setSaving(false);
                return;
            }
        } else {
            // Insert new product
            const { data, error } = await supabase.from('products').insert(productData).select('id').single();
            if (error || !data) {
                toast.error('Failed to create product');
                setSaving(false);
                return;
            }
            productId = data.id;
        }

        // Handle variants
        if (productId && variants.length > 0) {
            // Delete existing variants for this product
            await supabase.from('product_variants').delete().eq('product_id', productId);

            // Insert all variants
            const variantsToInsert = variants.map((v, index) => ({
                product_id: productId,
                variant_name: v.variant_name,
                variant_value: parseFloat(v.variant_value) || 1,
                variant_unit: v.variant_unit,
                price: parseFloat(v.price) || 0,
                mrp: v.mrp ? parseFloat(v.mrp) : null,
                is_default: v.is_default,
                display_order: index
            }));

            const { error: variantError } = await supabase.from('product_variants').insert(variantsToInsert);
            if (variantError) {
                console.error('Variant error:', variantError);
                toast.error('Product saved but some variants failed');
            }
        }

        // Save additional images to product_images table
        if (productId && additionalImages.length > 0) {
            console.log('Saving additional images:', additionalImages.length, 'images for product:', productId);

            // Delete existing additional images for this product
            const { error: deleteError } = await (supabase as any).from('product_images').delete().eq('product_id', productId);
            if (deleteError) {
                console.error('Error deleting existing images:', deleteError);
            }

            // Insert new additional images
            const imagesToInsert = additionalImages.map((url, index) => ({
                product_id: productId,
                image_url: url,
                display_order: index + 1,
                is_primary: false
            }));

            console.log('Inserting images:', imagesToInsert);
            const { error: imageError, data: insertedImages } = await (supabase as any).from('product_images').insert(imagesToInsert).select();
            if (imageError) {
                console.error('Image insert error:', imageError);
                toast.error('Product saved but some images failed: ' + imageError.message);
            } else {
                console.log('Images saved successfully:', insertedImages);
            }
        } else {
            console.log('No additional images to save. additionalImages:', additionalImages);
        }

        toast.success(isEditing ? 'Product updated successfully!' : 'Product created successfully!');
        navigate('/admin');
        setSaving(false);
    };

    const addVariant = () => {
        setVariants([...variants, {
            variant_name: '',
            variant_value: '1',
            variant_unit: 'kg',
            price: '',
            mrp: '',
            is_default: variants.length === 0
        }]);
    };

    const updateVariant = (index: number, field: keyof ProductVariant, value: string | boolean) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], [field]: value };

        // If setting as default, unset others
        if (field === 'is_default' && value === true) {
            updated.forEach((v, i) => {
                if (i !== index) v.is_default = false;
            });
        }

        setVariants(updated);
    };

    const removeVariant = (index: number) => {
        const updated = variants.filter((_, i) => i !== index);
        // Ensure at least one is default if any remain
        if (updated.length > 0 && !updated.some(v => v.is_default)) {
            updated[0].is_default = true;
        }
        setVariants(updated);
    };

    // Auto-calculate discount percentage for display
    const discountPercent = productForm.mrp && productForm.price
        ? Math.round(((parseFloat(productForm.mrp) - parseFloat(productForm.price)) / parseFloat(productForm.mrp)) * 100)
        : 0;

    if (loading || userRole === null || loadingProduct) {
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
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isEditing ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-green-500 to-emerald-600'}`}>
                                {isEditing ? <Edit className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">{isEditing ? 'Edit Product' : 'Add Product'}</h1>
                                <p className="text-xs text-muted-foreground">{isEditing ? 'Update product details' : 'Create new product'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
                {/* Basic Info Card */}
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

                        {/* MRP and Selling Price */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="mrp" className="text-sm font-medium">
                                    MRP (₹) <span className="text-muted-foreground text-xs">(Original Price)</span>
                                </Label>
                                <Input
                                    id="mrp"
                                    type="number"
                                    value={productForm.mrp}
                                    onChange={(e) => setProductForm({ ...productForm, mrp: e.target.value })}
                                    placeholder="0"
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price" className="text-sm font-medium">
                                    Selling Price (₹) <span className="text-destructive">*</span>
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
                        </div>

                        {/* Auto-calculated discount display */}
                        {discountPercent > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                <span className="text-green-700 dark:text-green-400 font-semibold">💰 {discountPercent}% OFF</span>
                                <span className="text-sm text-green-600 dark:text-green-500">Auto-calculated from MRP & Selling Price</span>
                            </div>
                        )}

                        {/* Stock and Unit */}
                        <div className="grid grid-cols-2 gap-4">
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
                            <div className="space-y-2">
                                <Label htmlFor="unit" className="text-sm font-medium">Unit</Label>
                                <Select value={productForm.unit} onValueChange={(value) => setProductForm({ ...productForm, unit: value })}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {UNIT_OPTIONS.map(u => (
                                            <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Image URLs - Multi-image support */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                <ImagePlus className="h-4 w-4" />
                                Product Images
                            </Label>

                            {/* Primary Image */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Primary Image (Main display)</Label>
                                <Input
                                    id="image"
                                    value={productForm.image_url}
                                    onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                                    placeholder="https://example.com/primary-image.jpg"
                                    className="h-12"
                                />
                            </div>

                            {/* Additional Images */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Additional Images (Gallery)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={newImageUrl}
                                        onChange={(e) => setNewImageUrl(e.target.value)}
                                        placeholder="https://example.com/additional-image.jpg"
                                        className="h-12 flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-12"
                                        onClick={() => {
                                            if (newImageUrl.trim()) {
                                                setAdditionalImages([...additionalImages, newImageUrl.trim()]);
                                                setNewImageUrl('');
                                            }
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Image Preview Grid */}
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                {productForm.image_url && (
                                    <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-primary">
                                        <img
                                            src={productForm.image_url}
                                            alt="Primary"
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                                            Primary
                                        </span>
                                    </div>
                                )}
                                {additionalImages.map((url, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border group">
                                        <img
                                            src={url}
                                            alt={`Image ${index + 2}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setAdditionalImages(additionalImages.filter((_, i) => i !== index))}
                                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {(productForm.image_url || additionalImages.length > 0) && (
                                <p className="text-xs text-muted-foreground">
                                    {1 + additionalImages.length} image(s) added
                                </p>
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
                    </CardContent>
                </Card>

                {/* Variants Card */}
                <Card className="border-blue-200 dark:border-blue-800 shadow-xl bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                📦 Product Variants
                                <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                            </CardTitle>
                            <Button variant="outline" size="sm" onClick={addVariant}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Variant
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">Add different sizes/quantities like 500g, 1kg, 1 dozen, 6 pieces...</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {variants.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No variants added. Product will use the base price above.</p>
                                <Button variant="link" onClick={addVariant} className="mt-2">
                                    + Add your first variant
                                </Button>
                            </div>
                        ) : (
                            variants.map((variant, index) => (
                                <div key={index} className="p-4 border border-border/50 rounded-lg bg-muted/30 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={variant.is_default}
                                                onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span className="text-sm text-muted-foreground">Default</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeVariant(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Display Name</Label>
                                            <Input
                                                value={variant.variant_name}
                                                onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                                                placeholder="e.g. 500g, 1 kg"
                                                className="h-10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Value</Label>
                                            <Input
                                                type="number"
                                                value={variant.variant_value}
                                                onChange={(e) => updateVariant(index, 'variant_value', e.target.value)}
                                                placeholder="0.5"
                                                className="h-10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Unit</Label>
                                            <Select value={variant.variant_unit} onValueChange={(v) => updateVariant(index, 'variant_unit', v)}>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {UNIT_OPTIONS.map(u => (
                                                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">MRP (₹)</Label>
                                            <Input
                                                type="number"
                                                value={variant.mrp}
                                                onChange={(e) => updateVariant(index, 'mrp', e.target.value)}
                                                placeholder="Original price"
                                                className="h-10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Selling Price (₹) *</Label>
                                            <Input
                                                type="number"
                                                value={variant.price}
                                                onChange={(e) => updateVariant(index, 'price', e.target.value)}
                                                placeholder="Selling price"
                                                className="h-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Submit Button */}
                <Button
                    onClick={handleSaveProduct}
                    disabled={saving}
                    className="w-full h-14 text-base font-semibold shadow-lg"
                    size="lg"
                >
                    {saving ? (
                        <>
                            <Package className="h-5 w-5 mr-2 animate-spin" />
                            {isEditing ? 'Updating...' : 'Creating...'}
                        </>
                    ) : (
                        <>
                            <Save className="h-5 w-5 mr-2" />
                            {isEditing ? 'Update Product' : 'Create Product'}
                        </>
                    )}
                </Button>
            </main>

            <AdminBottomNav />
        </div>
    );
}
