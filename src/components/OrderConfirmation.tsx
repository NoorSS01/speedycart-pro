import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OrderConfirmationProps {
    orderId: string;
    onClose?: () => void;
}

export default function OrderConfirmation({ onClose }: OrderConfirmationProps) {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);

    useEffect(() => {
        // High-performance animation timeline
        const sequence = [
            { t: 100, s: 1 },  // Intro blobs
            { t: 400, s: 2 },  // Logo Scale In
            { t: 1100, s: 3 }, // Success Ripple + Check
            { t: 1600, s: 4 }, // Text Fade In
            { t: 4000, s: 5 }  // Exit
        ];

        const timers = sequence.map(({ t, s }) => setTimeout(() => setStep(s), t));

        const exitTimer = setTimeout(() => {
            if (onClose) onClose();
            navigate('/orders');
        }, 4000);

        return () => {
            timers.forEach(clearTimeout);
            clearTimeout(exitTimer);
        };
    }, [navigate, onClose]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={() => {
                if (onClose) onClose();
                navigate('/orders');
            }}
        >
            {/* Premium Glass Background with Animated Blobs */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[20px] transition-opacity duration-1000 ease-out"
                style={{ opacity: step >= 1 ? 1 : 0 }} />

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/30 rounded-full blur-[100px] mix-blend-screen animate-blob transition-opacity duration-1000 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute top-1/3 right-1/4 w-96 h-96 bg-green-400/30 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000 transition-opacity duration-1000 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute -bottom-32 left-1/3 w-96 h-96 bg-teal-500/30 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-4000 transition-opacity duration-1000 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`} />
            </div>

            {/* Main Content Stage */}
            <div className="relative z-10 flex flex-col items-center justify-center p-8">

                {/* Logo Composition */}
                <div className="relative w-40 h-40 flex items-center justify-center mb-8">

                    {/* Success Ripple Effect */}
                    {step >= 3 && (
                        <div className="absolute inset-0 rounded-full border-4 border-emerald-400/50 animate-ripple-expand" />
                    )}

                    {/* Glass Container for Logo */}
                    <div className={`relative w-32 h-32 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) ${step >= 2 ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-12'
                        }`}>
                        <img
                            src="/dist/logo.svg"
                            alt="Brand"
                            className="w-20 h-20 object-contain drop-shadow-lg"
                        />
                    </div>

                    {/* Verified Badge Overlay */}
                    <div className={`absolute -bottom-1 -right-1 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg ring-4 ring-black/20 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${step >= 3 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                        }`}>
                        <Check className="w-6 h-6 text-white stroke-[4]" />
                        {/* SVG Circle Drawing Animation */}
                        {step >= 3 && (
                            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                                <circle
                                    cx="24" cy="24" r="22"
                                    stroke="white"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeDasharray="140"
                                    strokeDashoffset="140"
                                    className="animate-draw-check opacity-50"
                                />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Typography */}
                <div className={`text-center transition-all duration-1000 delay-100 ${step >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                    }`}>
                    <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tighter mb-4 drop-shadow-xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                        Order Placed
                    </h2>
                    <div className="h-1 w-16 bg-emerald-500/50 mx-auto rounded-full mb-4" />
                    <p className="text-emerald-100/90 text-lg font-medium tracking-wide">
                        Redirecting to confirmation...
                    </p>
                </div>

            </div>
        </div>
    );
}
