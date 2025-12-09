import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface BottomNavProps {
  cartItemCount?: number;
}

export default function BottomNav({ cartItemCount = 0 }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/shop', ariaLabel: 'Go to Shop' },
    { icon: ShoppingCart, label: 'Cart', path: '/cart', showBadge: true, ariaLabel: 'View Cart' },
    { icon: ClipboardList, label: 'Orders', path: '/orders', ariaLabel: 'View Orders' },
    { icon: User, label: 'Profile', path: '/profile', ariaLabel: 'View Profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
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
  );
}

