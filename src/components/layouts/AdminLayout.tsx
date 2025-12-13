import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Settings,
    LogOut,
    Bell,
    CreditCard,
    Boxes,
    Menu,
    X,
    ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
    showBackButton?: boolean;
}

const NAV_ITEMS = [
    { label: 'Home', icon: LayoutDashboard, path: '/admin' },
    { label: 'Stock', icon: Boxes, path: '/admin/stock' },
    { label: 'Orders', icon: ShoppingCart, path: '/orders' },
    { label: 'Pay', icon: CreditCard, path: '/admin/to-pay' },
    { label: 'Alerts', icon: Bell, path: '/admin/notifications' },
];

export default function AdminLayout({ children, title, showBackButton }: AdminLayoutProps) {
    const { user, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900/50 flex flex-col transition-colors duration-300">

            {/* Top Header (Mobile & Desktop) */}
            <header className={`sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-4 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200/50 dark:border-slate-800/50' : 'bg-transparent'
                }`}>
                <div className="flex items-center gap-3">
                    {showBackButton && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mr-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => navigate(-1)}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    )}

                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <span className="font-bold text-white text-sm">S</span>
                        </div>
                        <div>
                            {title ? (
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">{title}</h1>
                            ) : (
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">SpeedyCart</h1>
                            )}
                            <p className="text-[10px] text-emerald-500 font-bold tracking-wider uppercase">Admin Pro</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8 border-2 border-emerald-500/20">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                                    <AvatarFallback>AD</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user?.email}</p>
                                    <p className="text-xs leading-none text-muted-foreground">Administrator</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate('/super-admin')}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Super Admin Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => signOut()}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 pb-24 animate-in fade-in duration-500 slide-in-from-bottom-4">
                <div className="px-4 md:px-8 max-w-7xl mx-auto space-y-6">
                    {children}
                </div>
            </main>

            {/* Premium Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 pb-safe">
                <div className="flex justify-around items-center h-16 max-w-md mx-auto md:max-w-4xl px-2">
                    {NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 group ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                            >
                                {/* Active Indicator Background */}
                                {isActive && (
                                    <div className="absolute top-1 w-12 h-1 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                )}

                                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 -translate-y-1' : ''
                                    }`}>
                                    <item.icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110 stroke-[2.5px]' : 'group-hover:scale-110'}`} />
                                </div>
                                <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0 font-bold' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                                    }`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
