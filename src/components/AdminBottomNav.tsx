import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Boxes, Megaphone, Wallet, Settings, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: 'Home', path: '/admin' },
        { icon: ShoppingBag, label: 'Orders', path: '/super-admin' },
        { icon: Boxes, label: 'Stock', path: '/admin/stock' },
        { icon: Wallet, label: 'Payments', path: '/admin/to-pay' },
        { icon: Settings, label: 'More', path: '/super-admin' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_-10px_40px_rgba(15,23,42,0.35)]">
            <div className="container mx-auto px-2">
                <div className="flex items-center justify-around py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path ||
                            (item.path === '/super-admin' && location.pathname.startsWith('/super'));

                        return (
                            <button
                                key={item.label}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all",
                                    isActive
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
