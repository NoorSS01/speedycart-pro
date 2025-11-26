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
  ClipboardList
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';

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
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: Product;
}

export default function Shop() {
  const { user, signOut } = useAuth();
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

  useEffect(() => {
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
  }, [user, navigate]);

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

    const existingItem = cartItems.find(item => item.product_id === productId);

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
    setShowAddressDialog(true);
  };

  const confirmOrder = async () => {
    if (!user || cartItems.length === 0) return;

    const deliveryAddress = addressOption === 'saved' ? savedAddress : newAddress.trim();

    if (!deliveryAddress) {
      toast.error('Please provide a delivery address');
      return;
    }

    try {
      // Save new address to profile if using new address
      if (addressOption === 'new' && newAddress.trim()) {
        await supabase
          .from('profiles')
          .update({ address: newAddress.trim() })
          .eq('id', user.id);
        setSavedAddress(newAddress.trim());
      }

      const totalAmount = cartItems.reduce(
        (sum, item) => sum + item.products.price * item.quantity,
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

      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.products.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Order items error:', itemsError);
        toast.error(`Failed to create order items: ${itemsError.message}`);
        return;
      }

      // Auto-assign to a delivery person (simplified - just get first available)
      const { data: deliveryPerson, error: deliveryError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'delivery')
        .limit(1)
        .maybeSingle();

      if (deliveryPerson) {
        await supabase
          .from('delivery_assignments')
          .insert({
            order_id: order.id,
            delivery_person_id: deliveryPerson.user_id
          });
      }

      // Clear cart
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      fetchCart();
      setShowAddressDialog(false);
      setShowCartSheet(false);
      setNewAddress('');
      toast.success('Order placed successfully!');
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
      <div className="min-h-screen flex items-center justify-center">
        <Package className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">QuickCommerce</h1>
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
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(null)}
              className="rounded-full"
            >
              All
            </Button>
            {categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="aspect-square bg-muted flex items-center justify-center">
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
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-primary">${product.price}</p>
                      <p className="text-xs text-muted-foreground">/ {product.unit}</p>
                    </div>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => addToCart(product.id)}
                      disabled={product.stock_quantity <= 0}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {product.stock_quantity <= 0 && (
                    <Badge variant="destructive" className="w-full mt-2 justify-center">
                      Out of Stock
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
      <BottomNav cartItemCount={cartItems.length} />
    </div>
  );
}
