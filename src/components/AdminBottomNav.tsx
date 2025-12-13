import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Boxes, ShoppingBag, Wallet, Menu, Truck, Shield, Users, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

export default function AdminBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);

    const mainNavItems = [
        { icon: LayoutDashboard, label: 'Home', path: '/admin' },
        { icon: ShoppingBag, label: 'Orders', path: '/admin/orders' },
        { icon: Boxes, label: 'Stock', path: '/admin/stock' },
        { icon: Wallet, label: 'Payments', path: '/admin/to-pay' },
    ];

    const moreItems = [
        { icon: Truck, label: 'Delivery Apps', path: '/admin/delivery-apps' },
        { icon: Shield, label: 'Security', path: '/admin/security' },
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: Megaphone, label: 'Broadcast', path: '/admin/notifications' },
    ];

    const handleNavigate = (path: string) => {
        navigate(path);
        setOpen(false);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_-10px_40px_rgba(15,23,42,0.35)]">
            <div className="container mx-auto px-2">
                <div className="flex items-center justify-around py-2">
                    {mainNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

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

                    {/* More Menu */}
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <button
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all",
                                    "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <Menu className="h-5 w-5" />
                                <span className="text-[10px] font-medium">More</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-auto">
                            <SheetHeader className="pb-4">
                                <SheetTitle>More Options</SheetTitle>
                            </SheetHeader>
                            <div className="grid grid-cols-4 gap-4 pb-6">
                                {moreItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path;

                                    return (
                                        <button
                                            key={item.label}
                                            onClick={() => handleNavigate(item.path)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all",
                                                isActive
                                                    ? "text-primary bg-primary/10"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <Icon className="h-6 w-6" />
                                            <span className="text-xs font-medium">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
}
