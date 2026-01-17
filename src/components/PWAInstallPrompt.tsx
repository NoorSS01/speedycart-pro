import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Share, Plus, Smartphone, CheckCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

// Detect iOS
const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Detect if running as standalone PWA
const isStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
};

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [showIOSPrompt, setShowIOSPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [installSuccess, setInstallSuccess] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (isStandalone()) {
            setIsInstalled(true);
            return;
        }

        // Check if dismissed recently (within 3 days - reduced from 7)
        const dismissedAt = localStorage.getItem('pwa-prompt-dismissed');
        if (dismissedAt) {
            const dismissedDate = new Date(dismissedAt);
            const daysSinceDismiss = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceDismiss < 3) {
                return;
            }
        }

        // For iOS devices, show custom instructions
        if (isIOS()) {
            // Show iOS prompt after 3 seconds
            setTimeout(() => setShowIOSPrompt(true), 3000);
            return;
        }

        // For Android/Chrome, use beforeinstallprompt
        const handler = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Show prompt after 2 seconds (faster)
            setTimeout(() => setShowPrompt(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Listen for successful install
        window.addEventListener('appinstalled', () => {
            setIsInstalling(false);
            setInstallSuccess(true);
            // Show success for 2 seconds, then hide
            setTimeout(() => {
                setIsInstalled(true);
                setShowPrompt(false);
                setDeferredPrompt(null);
                setInstallSuccess(false);
            }, 2000);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Show installing state IMMEDIATELY before prompting
        setIsInstalling(true);
        setShowPrompt(true); // Ensure banner stays visible

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                // User accepted - show success after short delay
                // (appinstalled event may or may not fire depending on browser)
                setTimeout(() => {
                    setInstallSuccess(true);
                    setIsInstalling(false);
                    // Auto-hide after showing success
                    setTimeout(() => {
                        setShowPrompt(false);
                        setDeferredPrompt(null);
                        setIsInstalled(true);
                    }, 2000);
                }, 1500);
            } else {
                // User dismissed - hide installing state
                setIsInstalling(false);
            }
        } catch (error) {
            console.error('PWA install error:', error);
            setIsInstalling(false);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setShowIOSPrompt(false);
        localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
    };

    if (isInstalled) {
        return null;
    }

    // iOS Install Instructions
    if (showIOSPrompt) {
        return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-end animate-in fade-in duration-300">
                <div className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <Smartphone className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl text-foreground">Install PremasShop</h3>
                                <p className="text-sm text-muted-foreground">Get the full app experience</p>
                            </div>
                        </div>
                        <button onClick={handleDismiss} className="text-muted-foreground p-2 -m-2">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="space-y-4 mb-6">
                        <p className="text-muted-foreground">
                            Install this app on your iPhone for quick access and offline shopping!
                        </p>

                        <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">1</div>
                                <div className="flex items-center gap-2 text-foreground">
                                    <span>Tap the</span>
                                    <Share className="h-5 w-5 text-blue-500" />
                                    <span className="font-medium">Share</span>
                                    <span>button below</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">2</div>
                                <div className="flex items-center gap-2 text-foreground">
                                    <span>Scroll and tap</span>
                                    <Plus className="h-5 w-5" />
                                    <span className="font-medium">"Add to Home Screen"</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 font-bold text-sm">3</div>
                                <span className="text-foreground">Tap <span className="font-medium">"Add"</span> to install!</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={handleDismiss} variant="outline" className="flex-1">
                            Maybe Later
                        </Button>
                        <Button onClick={handleDismiss} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                            Got It!
                        </Button>
                    </div>

                    {/* iOS home indicator safe area */}
                    <div className="h-2" />
                </div>
            </div>
        );
    }

    // Android/Chrome Install Prompt  
    if (!showPrompt || !deferredPrompt) {
        return null;
    }

    // Installing/Downloading Banner - Fullscreen centered per PM spec
    if (isInstalling || installSuccess) {
        return (
            <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 flex items-center justify-center">
                <div className="w-full max-w-sm px-8 text-center">
                    {/* Icon */}
                    <div className="w-20 h-20 mx-auto mb-8 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center shadow-2xl">
                        {installSuccess ? (
                            <CheckCircle className="h-10 w-10 text-white" />
                        ) : (
                            <Download className="h-10 w-10 text-white animate-bounce" />
                        )}
                    </div>

                    {/* Progress Bar - Centered and prominent */}
                    {!installSuccess && (
                        <div className="mb-6">
                            <div className="bg-white/20 rounded-full h-3 overflow-hidden shadow-inner">
                                <div
                                    className="bg-white h-full rounded-full transition-all duration-500 ease-out"
                                    style={{ width: '60%' }}
                                />
                            </div>
                            <p className="text-white/90 text-lg font-medium mt-3">60%</p>
                        </div>
                    )}

                    {/* Status Text */}
                    <h2 className="text-white text-2xl font-bold mb-2">
                        {installSuccess ? 'Installation Complete!' : 'Downloading...'}
                    </h2>
                    <p className="text-white/80 text-base">
                        {installSuccess
                            ? 'PremasShop has been added to your home screen'
                            : 'Installing PremasShop on your device'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-20 left-0 right-0 z-50 px-4 animate-in slide-in-from-bottom-4 duration-300 md:left-auto md:right-4 md:max-w-sm">
            <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-2xl overflow-hidden">
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />

                <CardContent className="p-4 relative">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                            <Download className="h-7 w-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg">Install PremasShop</h3>
                            <p className="text-white/90 text-sm mt-1">
                                📱 Add to home screen for faster orders & offline access!
                            </p>
                            <div className="flex gap-2 mt-3">
                                <Button
                                    onClick={handleInstall}
                                    size="sm"
                                    className="bg-white text-green-600 hover:bg-white/90 font-semibold shadow-md"
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    Install Now
                                </Button>
                                <Button
                                    onClick={handleDismiss}
                                    size="sm"
                                    variant="ghost"
                                    className="text-white hover:bg-white/20"
                                >
                                    Later
                                </Button>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-white/70 hover:text-white p-1 -mt-1 -mr-1"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default PWAInstallPrompt;

