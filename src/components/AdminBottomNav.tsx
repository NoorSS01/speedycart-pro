import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Boxes, Megaphone, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
        { icon: Boxes, label: 'Stock', path: '/admin/stock' },
        { icon: Megaphone, label: 'Broadcast', path: '/admin/notifications' },
        { icon: Wallet, label: 'Payments', path: '/admin/to-pay' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_-10px_40px_rgba(15,23,42,0.35)]">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-around py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <button
                                key={item.label}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-2xl transition-all bg-background/20 hover:bg-background/40 border border-transparent hover:border-border/40 shadow-sm backdrop-blur-sm",
                                    isActive
                                        ? "text-primary bg-gradient-to-br from-primary/20 to-primary/10 border-primary/40 shadow-md"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                                <span className="text-xs font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
