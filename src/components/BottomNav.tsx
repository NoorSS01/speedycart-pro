import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useState, useEffect, useRef } from 'react';

/**
 * BottomNav Component
 * 
 * Features:
 * - Hides on scroll down (Shop page only)
 * - Shows on scroll up or at page top
 * - Floating cart button: When navbar is hidden and user adds to cart,
 *   shows ONLY the cart button for 3 seconds as feedback
 * 
 * Edge Cases Handled:
 * - User scrolls up during floating cart mode → full navbar shows
 * - User adds again while cart button visible → timer resets
 * - Works correctly on all pages
 */
export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartItemCount } = useCart();
  const { isScrollingDown, isAtTop, isScrollingUp } = useScrollDirection();

  // Track previous cart count to detect additions
  const prevCartCount = useRef(cartItemCount);
  // Timer ref for floating cart button
  const floatingCartTimer = useRef<NodeJS.Timeout | null>(null);
  // State for floating cart button visibility
  const [showFloatingCart, setShowFloatingCart] = useState(false);

  // Only hide navbar on Shop page with scroll behavior
  const isShopPage = location.pathname === '/shop';
  const shouldHideNavbar = isShopPage && isScrollingDown && !isAtTop;

  // Detect when items are added to cart while navbar is hidden
  useEffect(() => {
    const wasAdded = cartItemCount > prevCartCount.current;
    prevCartCount.current = cartItemCount;

    // Only show floating cart if navbar is hidden and item was just added
    if (wasAdded && shouldHideNavbar) {
      // Show floating cart button
      setShowFloatingCart(true);

      // Clear existing timer and set new one
      if (floatingCartTimer.current) {
        clearTimeout(floatingCartTimer.current);
      }

      floatingCartTimer.current = setTimeout(() => {
        setShowFloatingCart(false);
      }, 3000); // Hide after 3 seconds
    }
  }, [cartItemCount, shouldHideNavbar]);

  // If user scrolls up, hide floating cart and show full navbar
  useEffect(() => {
    if (isScrollingUp && showFloatingCart) {
      setShowFloatingCart(false);
      if (floatingCartTimer.current) {
        clearTimeout(floatingCartTimer.current);
      }
    }
  }, [isScrollingUp, showFloatingCart]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (floatingCartTimer.current) {
        clearTimeout(floatingCartTimer.current);
      }
    };
  }, []);

  const navItems = [
    { icon: Home, label: 'Home', path: '/shop', ariaLabel: 'Go to Shop' },
    { icon: Grid3X3, label: 'Categories', path: '/categories', ariaLabel: 'Browse Categories' },
    { icon: ClipboardList, label: 'Orders', path: '/orders', ariaLabel: 'View Orders' },
    { icon: ShoppingCart, label: 'Cart', path: '/cart', showBadge: true, ariaLabel: 'View Cart' },
  ];

  return (
    <>
      {/* Floating Cart Button - appears when navbar hidden and item added */}
      {showFloatingCart && shouldHideNavbar && (
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className={cn(
            "fixed bottom-4 right-4 z-50 flex items-center justify-center",
            "w-14 h-14 rounded-full shadow-2xl",
            "bg-primary text-primary-foreground",
            "animate-in slide-in-from-bottom-5 fade-in duration-300",
            "hover:scale-105 active:scale-95 transition-transform"
          )}
          aria-label="View Cart"
        >
          <ShoppingCart className="h-6 w-6" />
          {cartItemCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-6 min-w-[1.5rem] flex items-center justify-center p-0 text-xs bg-white text-primary border-2 border-primary"
            >
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </Badge>
          )}
        </button>
      )}

      {/* Main Navigation Bar */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300",
          shouldHideNavbar ? "translate-y-full" : "translate-y-0"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-label={item.ariaLabel}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-2xl transition-all duration-200",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                  <span className="text-xs font-medium">{item.label}</span>
                  {item.showBadge && cartItemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] flex items-center justify-center p-0 text-xs">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
