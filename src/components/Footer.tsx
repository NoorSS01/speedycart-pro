import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import {
    Home,
    ShoppingBag,
    ShoppingCart,
    User,
    Settings,
    Phone,
    Mail,
    MapPin
} from 'lucide-react';

export default function Footer() {
    const navigate = useNavigate();

    const quickLinks = [
        { label: 'Home', path: '/shop', icon: Home },
        { label: 'Shop', path: '/shop', icon: ShoppingBag },
        { label: 'Cart', path: '/cart', icon: ShoppingCart },
        { label: 'Profile', path: '/profile', icon: User },
        { label: 'Settings', path: '/settings', icon: Settings },
    ];

    const legalLinks = [
        { label: 'Privacy Policy', path: '/privacy-policy' },
        { label: 'Terms & Conditions', path: '/terms' },
        { label: 'Refund Policy', path: '/refund-policy' },
        { label: 'Shipping Policy', path: '/shipping-policy' },
        { label: 'Payment Terms', path: '/payment-terms' },
        { label: 'Grievance Redressal', path: '/grievance' },
        { label: 'Contact Us', path: '/contact' },
    ];

    return (
        <footer className="bg-muted/50 border-t mt-auto">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Company Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-primary">SpeedyCart Pro</h3>
                        <p className="text-sm text-muted-foreground">
                            Your trusted grocery delivery partner. Fresh products delivered to your doorstep in 15-30 minutes.
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <span>+91 9876543210</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <span>support@speedycart.in</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>Chandapura-Anekal Road, Bangalore</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-4">
                        <h4 className="font-semibold">Quick Links</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {quickLinks.map((link) => (
                                <button
                                    key={link.path + link.label}
                                    onClick={() => navigate(link.path)}
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                                >
                                    <link.icon className="h-3 w-3" />
                                    {link.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Legal Links */}
                    <div className="space-y-4">
                        <h4 className="font-semibold">Legal</h4>
                        <div className="grid grid-cols-1 gap-1">
                            {legalLinks.map((link) => (
                                <button
                                    key={link.path}
                                    onClick={() => navigate(link.path)}
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors text-left py-1"
                                >
                                    {link.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <Separator className="my-6" />

                {/* Copyright */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} SpeedyCart Pro. All rights reserved.</p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/privacy-policy')}
                            className="hover:text-primary transition-colors"
                        >
                            Privacy
                        </button>
                        <button
                            onClick={() => navigate('/terms')}
                            className="hover:text-primary transition-colors"
                        >
                            Terms
                        </button>
                        <button
                            onClick={() => navigate('/contact')}
                            className="hover:text-primary transition-colors"
                        >
                            Contact
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
}
