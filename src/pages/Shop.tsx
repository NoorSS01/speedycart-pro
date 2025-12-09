import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import {
  LogOut,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Package,
  User,
  ClipboardList,
  Zap
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecommendations } from '@/hooks/useRecommendations';
import { Sparkles } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  image_url: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock_quantity: number;
  unit: string;
  category_id: string | null;
  discount_percent?: number | null;
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: Product;
}

export default function Shop() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [savedAddress, setSavedAddress] = useState<string>('');
  const [addressOption, setAddressOption] = useState<'saved' | 'new'>('saved');
  const [newAddress, setNewAddress] = useState('');
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [buyNowProduct, setBuyNowProduct] = useState<Product | null>(null);

  // AI Recommendations
  const { recommendedProducts, isLoading: recommendationsLoading, trackView } = useRecommendations();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchCategories();
    fetchProducts();
    fetchCart();
    fetchSavedAddress();

    // Listen for cart open event from bottom nav
    const handleOpenCart = () => setShowCartSheet(true);
    window.addEventListener('openCart', handleOpenCart);

    return () => window.removeEventListener('openCart', handleOpenCart);
  }, [user, authLoading, navigate]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (!error && data) {
      setCategories(data);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }

    const { data, error } = await query;

    if (!error && data) {
      setProducts(data);
    }
  };

  const fetchCart = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('cart_items')
      .select('*, products(*)')
      .eq('user_id', user.id);

    if (!error && data) {
      setCartItems(data as CartItem[]);
    }
  };

  const fetchSavedAddress = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('address')
      .eq('id', user.id)
      .single();

    if (data?.address) {
      setSavedAddress(data.address);
      setAddressOption('saved');
    } else {
      setAddressOption('new');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const addToCart = async (productId: string) => {
    if (!user) return;

    // Fetch fresh product data to get current stock
    const { data: freshProduct, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity, name')
      .eq('id', productId)
      .single();

    if (fetchError || !freshProduct) {
      toast.error('Failed to check stock availability');
      return;
    }

    const existingItem = cartItems.find(item => item.product_id === productId);
    const currentCartQty = existingItem ? existingItem.quantity : 0;
    const requestedQty = currentCartQty + 1;

    // Check if we have enough stock
    if (requestedQty > freshProduct.stock_quantity) {
      if (freshProduct.stock_quantity === 0) {
        toast.error(`${freshProduct.name} is out of stock`);
      } else if (currentCartQty >= freshProduct.stock_quantity) {
        toast.error(`Only ${freshProduct.stock_quantity} ${freshProduct.name} available. You already have ${currentCartQty} in cart.`);
      } else {
        toast.error(`Only ${freshProduct.stock_quantity} ${freshProduct.name} available`);
      }
      return;
    }

    if (existingItem) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: existingItem.quantity + 1 })
        .eq('id', existingItem.id);

      if (error) {
        toast.error('Failed to update cart');
      } else {
        fetchCart();
        toast.success('Cart updated');
      }
    } else {
      const { error } = await supabase
        .from('cart_items')
        .insert({ user_id: user.id, product_id: productId, quantity: 1 });

      if (error) {
        toast.error('Failed to add to cart');
      } else {
        fetchCart();
        toast.success('Added to cart');
      }
    }
  };

  const updateCartQuantity = async (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeFromCart(cartItemId);
      return;
    }

    // Find the cart item to get product info
    const cartItem = cartItems.find(item => item.id === cartItemId);
    if (!cartItem) return;

    // Fetch fresh stock data
    const { data: freshProduct, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity, name')
      .eq('id', cartItem.product_id)
      .single();

    if (fetchError || !freshProduct) {
      toast.error('Failed to check stock availability');
      return;
    }

    // Check if requested quantity exceeds available stock
    if (newQuantity > freshProduct.stock_quantity) {
      toast.error(`Only ${freshProduct.stock_quantity} ${freshProduct.name} available`);
      // Update to max available if trying to increase
      if (freshProduct.stock_quantity > 0 && freshProduct.stock_quantity !== cartItem.quantity) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: freshProduct.stock_quantity })
          .eq('id', cartItemId);
        if (!error) {
          fetchCart();
          toast.info(`Cart updated to maximum available (${freshProduct.stock_quantity})`);
        }
      }
      return;
    }

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: newQuantity })
      .eq('id', cartItemId);

    if (!error) {
      fetchCart();
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);

    if (!error) {
      fetchCart();
      toast.success('Removed from cart');
    }
  };

  const handlePlaceOrderClick = () => {
    if (!user || cartItems.length === 0) return;
    setBuyNowProduct(null); // Ensure we're in cart mode
    setShowAddressDialog(true);
  };

  const handleBuyNow = (product: Product) => {
    if (!user || product.stock_quantity <= 0) return;
    setBuyNowProduct(product);
    setShowAddressDialog(true);
  };

  const confirmOrder = async () => {
    if (!user) return;

    // Determine if this is a buy-now order or cart order
    const isBuyNow = buyNowProduct !== null;

    if (!isBuyNow && cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    const deliveryAddress = addressOption === 'saved' ? savedAddress : newAddress.trim();

    if (!deliveryAddress) {
      toast.error('Please provide a delivery address');
      return;
    }

    try {
      // Items to order - either single buy-now product or all cart items
      const itemsToOrder = isBuyNow
        ? [{ product_id: buyNowProduct.id, quantity: 1, price: buyNowProduct.price }]
        : cartItems.map(item => ({ product_id: item.product_id, quantity: item.quantity, price: item.products.price }));

      // Re-validate stock availability
      const productIds = itemsToOrder.map(item => item.product_id);
      const { data: freshProducts, error: stockCheckError } = await supabase
        .from('products')
        .select('id, name, stock_quantity')
        .in('id', productIds);

      if (stockCheckError || !freshProducts) {
        toast.error('Failed to verify stock. Please try again.');
        return;
      }

      const stockMap = new Map(freshProducts.map(p => [p.id, { name: p.name, stock: p.stock_quantity }]));

      // Check if any item exceeds available stock
      const insufficientStock = itemsToOrder.filter(item => {
        const productStock = stockMap.get(item.product_id);
        return productStock && item.quantity > productStock.stock;
      });

      if (insufficientStock.length > 0) {
        const messages = insufficientStock.map(item => {
          const productStock = stockMap.get(item.product_id);
          return `${productStock?.name}: Only ${productStock?.stock} available`;
        });
        toast.error(`Cannot place order: ${messages.join(', ')}`);
        return;
      }

      // Save new address to profile if using new address
      if (addressOption === 'new' && newAddress.trim()) {
        await supabase
          .from('profiles')
          .update({ address: newAddress.trim() })
          .eq('id', user.id);
        setSavedAddress(newAddress.trim());
      }

      const totalAmount = itemsToOrder.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          total_amount: totalAmount,
          delivery_address: deliveryAddress,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        toast.error(`Failed to place order: ${orderError.message}`);
        return;
      }

      if (!order) {
        toast.error('Failed to place order');
        return;
      }

      const orderItems = itemsToOrder.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Order items error:', itemsError);
        toast.error(`Failed to create order items: ${itemsError.message}`);
        return;
      }

      // Reduce stock for each product purchased
      for (const item of itemsToOrder) {
        const productStock = stockMap.get(item.product_id);
        if (productStock) {
          const newStock = Math.max(0, productStock.stock - item.quantity);
          await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', item.product_id);
        }
      }

      // Clear cart only if this was a cart order
      if (!isBuyNow) {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);
        fetchCart();
      }

      // Refresh products to show updated stock
      fetchProducts();
      setShowAddressDialog(false);
      setShowCartSheet(false);
      setBuyNowProduct(null);
      setNewAddress('');
      toast.success('🎉 Order placed successfully!');
    } catch (error) {
      console.error('Unexpected error placing order:', error);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.products.price * item.quantity,
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-32 rounded-md" />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-10 w-full max-w-md mx-auto rounded-md" />
        </div>

        <div className="container mx-auto px-4 pb-4">
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" />
            ))}
          </div>
        </div>

        <div className="container mx-auto px-4 pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="rounded-2xl border-2 border-border/40 bg-card overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <div className="flex gap-1.5">
                      <Skeleton className="h-8 w-16 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
      {/* Header with Tagline and Profile */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold tracking-tight">PremaShop</h1>
              </div>
              <p className="text-xs text-muted-foreground font-medium ml-8">
                ⚡ Rapid Delivery in 14 mins
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
              onClick={() => navigate('/profile')}
              aria-label="View Profile"
            >
              <User className="h-5 w-5 text-primary" />
            </Button>
          </div>
        </div>
      </header>

      {/* Cart Sheet - opened from bottom nav */}
      <Sheet open={showCartSheet} onOpenChange={setShowCartSheet}>
        <SheetTrigger asChild>
          <button id="cart-trigger" className="hidden" />
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Your Cart</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-4">
            {cartItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Your cart is empty</p>
            ) : (
              <div className="space-y-4">
                {cartItems.map(item => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.products.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            ${item.products.price} / {item.products.unit}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 ml-auto"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
          {cartItems.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
              <div className="flex justify-between mb-4">
                <span className="font-medium">Total:</span>
                <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
              </div>
              <Button className="w-full" onClick={handlePlaceOrderClick}>
                Place Order
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Search */}
      <div className="container mx-auto px-4 py-6">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="container mx-auto px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(null)}
            className="rounded-full flex-shrink-0"
          >
            All
          </Button>
          {categories.map(category => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category.id)}
              className="rounded-full flex-shrink-0 whitespace-nowrap"
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* For You - AI Recommendations */}
      {user && recommendedProducts.length > 0 && !searchQuery && !selectedCategory && (
        <div className="container mx-auto px-4 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-bold">For You</h2>
          </div>
          <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {recommendedProducts.slice(0, 8).map(product => (
              <div
                key={product.id}
                className="min-w-[160px] max-w-[160px] snap-start cursor-pointer"
                onClick={() => {
                  trackView(product.id);
                  navigate(`/product/${product.id}`);
                }}
              >
                <Card className="overflow-hidden rounded-xl border border-border/50 bg-card/90 hover:shadow-lg transition-all h-full">
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                      <Badge className="absolute top-1 right-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5">Low</Badge>
                    )}
                  </div>
                  <CardContent className="p-2">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-sm font-bold text-primary">₹{product.price}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map(product => {
            const isOutOfStock = product.stock_quantity <= 0;
            const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
            const isLimitedStock = product.stock_quantity > 5 && product.stock_quantity <= 10;

            return (
              <Card
                key={product.id}
                className={`overflow-hidden rounded-2xl border-2 bg-card/90 hover:shadow-xl transition-all relative ${isOutOfStock
                  ? 'border-destructive/60 bg-destructive/5'
                  : isLowStock
                    ? 'border-red-500/60 bg-red-50/50 dark:bg-red-950/20'
                    : isLimitedStock
                      ? 'border-orange-400/60 bg-orange-50/50 dark:bg-orange-950/20'
                      : 'border-border/40 hover:border-primary/40'
                  }`}
              >
                {/* Stock Warning Badge */}
                {(isLowStock || isLimitedStock) && !isOutOfStock && (
                  <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-bold ${isLowStock
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-orange-500 text-white'
                    }`}>
                    {isLowStock ? `Only ${product.stock_quantity} left!` : `${product.stock_quantity} left`}
                  </div>
                )}

                {/* Discount Badge */}
                {product.discount_percent && product.discount_percent > 0 && (
                  <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold shadow-lg">
                    {product.discount_percent}% OFF
                  </div>
                )}

                <CardContent className="p-0">
                  <div
                    className={`aspect-square bg-muted flex items-center justify-center cursor-pointer ${isOutOfStock ? 'opacity-50' : ''}`}
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3">
                    <h3
                      className="font-medium text-sm line-clamp-2 mb-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        {product.discount_percent && product.discount_percent > 0 ? (
                          <>
                            <p className="text-lg font-bold text-primary">
                              ₹{Math.round(product.price * (100 - product.discount_percent) / 100)}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-muted-foreground line-through">₹{product.price}</p>
                              <p className="text-xs text-muted-foreground">/ {product.unit}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-bold text-primary">₹{product.price}</p>
                            <p className="text-xs text-muted-foreground">/ {product.unit}</p>
                          </>
                        )}
                      </div>
                      <Button
                        size="icon"
                        className={`h-9 w-9 rounded-full ${isOutOfStock ? 'opacity-50' : ''}`}
                        onClick={() => addToCart(product.id)}
                        disabled={isOutOfStock}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {isOutOfStock && (
                      <Badge variant="destructive" className="w-full mt-2 justify-center">
                        Out of Stock
                      </Badge>
                    )}
                    {isLowStock && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-2 text-center">
                        🔥 Hurry! Almost sold out
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Delivery Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup value={addressOption} onValueChange={(value) => setAddressOption(value as 'saved' | 'new')}>
              {savedAddress && (
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <RadioGroupItem value="saved" id="saved" />
                  <div className="flex-1">
                    <Label htmlFor="saved" className="font-medium cursor-pointer">
                      Use Saved Address
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">{savedAddress}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <RadioGroupItem value="new" id="new" />
                <div className="flex-1">
                  <Label htmlFor="new" className="font-medium cursor-pointer">
                    Enter New Address
                  </Label>
                  {addressOption === 'new' && (
                    <Textarea
                      placeholder="Enter your complete delivery address..."
                      className="mt-3"
                      rows={4}
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddressDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmOrder}>
              Confirm Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
