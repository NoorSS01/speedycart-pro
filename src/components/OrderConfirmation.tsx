import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OrderConfirmationProps {
    orderId: string; // Kept for prop compatibility but hidden
    onClose?: () => void;
}

export default function OrderConfirmation({ onClose }: OrderConfirmationProps) {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);

    useEffect(() => {
        // Animation sequence
        const timer1 = setTimeout(() => setStep(1), 300); // Logo appears
        const timer2 = setTimeout(() => setStep(2), 1000); // Checkmark appears
        const timer3 = setTimeout(() => setStep(3), 1500); // Text appears
        const timer4 = setTimeout(() => {
            // Auto redirect after 3.5 seconds
            if (onClose) onClose();
            navigate('/orders');
        }, 3500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [navigate, onClose]);

    return (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={() => {
                if (onClose) onClose();
                navigate('/orders');
            }}>

            {/* Ambient Background Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(12)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute bg-white/10 rounded-full blur-xl animate-pulse"
                        style={{
                            width: Math.random() * 200 + 50 + 'px',
                            height: Math.random() * 200 + 50 + 'px',
                            left: Math.random() * 100 + '%',
                            top: Math.random() * 100 + '%',
                            animationDuration: Math.random() * 5 + 3 + 's',
                            transition: 'all 1s ease'
                        }}
                    />
                ))}
            </div>

            <div className="relative z-10 flex flex-col items-center">
                {/* Logo & Checkmark Container */}
                <div className="relative mb-8">
                    {/* Logo Circle */}
                    <div className={`w-32 h-32 bg-white rounded-3xl shadow-2xl flex items-center justify-center transform transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${step >= 1 ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-10'
                        } `}>
                        <img
                            src="/dist/logo.svg"
                            alt="Logo"
                            className="w-20 h-20 object-contain"
                        />
                    </div>

                    {/* Animated Checkmark Badge */}
                    <div className={`absolute -bottom-2 -right-2 w-12 h-12 bg-green-500 rounded-full border-4 border-emerald-600 flex items-center justify-center transform transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${step >= 2 ? 'scale-100 rotate-0' : 'scale-0 rotate-[-45deg]'
                        } `}>
                        <Check className="w-7 h-7 text-white stroke-[3]" />
                    </div>

                    {/* Sparkles around logo */}
                    {step >= 2 && (
                        <>
                            <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-yellow-300 animate-spin-slow opacity-80" />
                            <Sparkles className="absolute bottom-4 -left-6 w-6 h-6 text-yellow-200 animate-pulse opacity-60" />
                        </>
                    )}
                </div>

                {/* Text Content */}
                <div className={`text-center transform transition-all duration-700 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    } `}>
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                        Order Placed
                    </h1>
                    <p className="text-emerald-100 text-lg font-medium">
                        Redirecting to your orders...
                    </p>
                </div>
            </div>
        </div>
    );
}
