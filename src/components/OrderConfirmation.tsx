import { useEffect, useState } from 'react';
import { CheckCircle, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface OrderConfirmationProps {
    orderId: string;
    onClose?: () => void;
}

export default function OrderConfirmation({ orderId, onClose }: OrderConfirmationProps) {
    const navigate = useNavigate();
    const [showContent, setShowContent] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showCheckmark, setShowCheckmark] = useState(false);

    useEffect(() => {
        // Staggered animation sequence
        const timer1 = setTimeout(() => setShowCheckmark(true), 200);
        const timer2 = setTimeout(() => setShowConfetti(true), 400);
        const timer3 = setTimeout(() => setShowContent(true), 800);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);

    const handleViewOrder = () => {
        if (onClose) onClose();
        navigate('/orders');
    };

    const handleContinueShopping = () => {
        if (onClose) onClose();
        navigate('/shop');
    };

    return (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 flex items-center justify-center overflow-hidden">
            {/* Animated Background Particles */}
            <div className="absolute inset-0 overflow-hidden">
                {showConfetti && (
                    <>
                        {/* Floating circles */}
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-float-up"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${80 + Math.random() * 40}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${3 + Math.random() * 3}s`
                                }}
                            >
                                <div
                                    className="rounded-full bg-white/20"
                                    style={{
                                        width: `${10 + Math.random() * 30}px`,
                                        height: `${10 + Math.random() * 30}px`
                                    }}
                                />
                            </div>
                        ))}

                        {/* Sparkles */}
                        {[...Array(15)].map((_, i) => (
                            <div
                                key={`sparkle-${i}`}
                                className="absolute animate-pulse-scale"
                                style={{
                                    left: `${10 + Math.random() * 80}%`,
                                    top: `${10 + Math.random() * 80}%`,
                                    animationDelay: `${Math.random() * 1.5}s`
                                }}
                            >
                                <Sparkles className="text-yellow-300/60" style={{ width: 16 + Math.random() * 20 }} />
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Main Content */}
            <div className="relative z-10 text-center px-6 max-w-md mx-auto">
                {/* Animated Checkmark Circle */}
                <div className={`transition-all duration-700 ease-out ${showCheckmark ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                    <div className="relative mx-auto w-32 h-32 mb-8">
                        {/* Outer ring pulse */}
                        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />

                        {/* Middle ring */}
                        <div className="absolute inset-2 rounded-full bg-white/30 animate-pulse" />

                        {/* Inner circle with checkmark */}
                        <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center shadow-2xl">
                            <CheckCircle className="w-16 h-16 text-green-600 animate-bounce-once" />
                        </div>
                    </div>
                </div>

                {/* Text Content */}
                <div className={`transition-all duration-700 delay-200 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                        Order Placed! 🎉
                    </h1>

                    <p className="text-white/90 text-lg mb-2">
                        Thank you for your order
                    </p>

                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4 mb-8 inline-block">
                        <p className="text-white/80 text-sm mb-1">Order ID</p>
                        <p className="text-white font-mono font-bold text-lg tracking-wide">
                            #{orderId.slice(0, 8).toUpperCase()}
                        </p>
                    </div>

                    {/* Package Animation */}
                    <div className="flex items-center justify-center gap-2 text-white/80 mb-8">
                        <Package className="w-5 h-5 animate-bounce" />
                        <span className="text-sm">Your order is being prepared</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            onClick={handleViewOrder}
                            className="bg-white text-green-600 hover:bg-white/90 font-semibold px-8 py-6 text-base rounded-xl shadow-lg"
                        >
                            View Order
                        </Button>

                        <Button
                            onClick={handleContinueShopping}
                            variant="outline"
                            className="border-2 border-white/50 text-white hover:bg-white/10 font-semibold px-8 py-6 text-base rounded-xl bg-transparent"
                        >
                            Continue Shopping
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bottom Wave */}
            <div className="absolute bottom-0 left-0 right-0">
                <svg viewBox="0 0 1440 120" className="w-full h-20 fill-white/10">
                    <path d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z" />
                </svg>
            </div>
        </div>
    );
}
