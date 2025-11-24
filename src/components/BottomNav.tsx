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

  const handleCartClick = () => {
    // Dispatch custom event to open cart sheet
    window.dispatchEvent(new Event('openCart'));
  };

  const navItems = [
    { icon: Home, label: 'Home', path: '/shop', action: () => navigate('/shop') },
    { icon: ShoppingCart, label: 'Cart', path: '/shop', showBadge: true, action: handleCartClick },
    { icon: ClipboardList, label: 'Orders', path: '/orders', action: () => navigate('/orders') },
    { icon: User, label: 'Profile', path: '/profile', action: () => navigate('/profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path && item.label !== 'Cart';
            
            return (
              <button
                key={item.label}
                onClick={item.action}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-lg transition-all",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                <span className="text-xs font-medium">{item.label}</span>
                {item.showBadge && cartItemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {cartItemCount}
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
