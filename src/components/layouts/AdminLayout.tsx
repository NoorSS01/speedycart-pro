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
    Menu,
    X,
    Bell,
    Search,
    ChevronLeft,
    CreditCard,
    TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
    showBackButton?: boolean;
}

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { label: 'Products', icon: Package, path: '/shop' }, // Might need admin-specific product list later
    { label: 'Orders', icon: ShoppingCart, path: '/orders' }, // Might need admin orders page
    { label: 'Stock', icon: Boxes, path: '/admin/stock', iconComponent: Package }, // Fallback icon
    { label: 'Payments', icon: CreditCard, path: '/admin/to-pay' },
    { label: 'Notifications', icon: Bell, path: '/admin/notifications' },
];

export default function AdminLayout({ children, title, showBackButton }: AdminLayoutProps) {
    const { user, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const NavContent = () => (
        <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl text-white border-r border-white/10">
            {/* Logo Area */}
            <div className="p-6 flex items-center gap-3 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <span className="font-bold text-lg">S</span>
                </div>
                <div>
                    <h1 className="font-bold text-lg tracking-tight">SpeedyCart</h1>
                    <p className="text-xs text-slate-400 font-medium tracking-wide text-emerald-400">ADMIN PRO</p>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                                    ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/10 text-emerald-400 font-medium'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                            )}
                            <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'group-hover:scale-110'}`} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}

                <div className="mt-8">
                    <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System</p>
                    <Link
                        to="/super-admin"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 ${location.pathname === '/super-admin' ? 'text-purple-400 bg-purple-500/10' : ''}`}
                    >
                        <Settings className="w-5 h-5" />
                        <span>Super Admin</span>
                    </Link>
                </div>
            </div>

            {/* User Footer */}
            <div className="p-4 border-t border-white/10 bg-black/20">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 transition-colors text-left group">
                            <Avatar className="w-10 h-10 border-2 border-emerald-500/30 group-hover:border-emerald-500 transition-colors">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                                <AvatarFallback className="bg-emerald-800 text-emerald-200">AD</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                                <p className="text-xs text-slate-400">Administrator</p>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-700 text-slate-200">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem className="focus:bg-slate-800 focus:text-white cursor-pointer" onClick={() => navigate('/profile')}>
                            <Users className="w-4 h-4 mr-2" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-red-900/20 focus:text-red-400 text-red-400 cursor-pointer" onClick={() => signOut()}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900/50 flex transition-colors duration-300">
            {/* Desktop Sidebar */}
            <aside className="hidden md:block w-72 h-screen sticky top-0 z-40 shadow-2xl shadow-slate-900/5">
                <NavContent />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col">
                {/* Responsive Header */}
                <header className={`sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-4 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200/50 dark:border-slate-800/50' : 'bg-transparent'
                    }`}>
                    <div className="flex items-center gap-3">
                        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button size="icon" variant="ghost" className="md:hidden hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <Menu className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-80 border-r-slate-800 shadow-2xl">
                                <NavContent />
                            </SheetContent>
                        </Sheet>

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

                        <div>
                            {title && <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight animate-in fade-in slide-in-from-left-4 duration-500">{title}</h1>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Global Search (Visual Only for now) */}
                        <div className="hidden md:flex relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input
                                placeholder="Search..."
                                className="pl-9 w-64 bg-white/50 border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-full"
                            />
                        </div>

                        <Button size="icon" variant="ghost" className="relative hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                        </Button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-4 md:p-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

// Fallback icon for Stock
import { Boxes } from 'lucide-react';
