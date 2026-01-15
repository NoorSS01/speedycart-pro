import { useState, useEffect } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
    onComplete?: () => void;
    duration?: number;
}

/**
 * Premium PWA Splash Screen with dynamic animation.
 * PM Spec: Orbit → Attract → Impact → Finale phases
 * Duration: 2.8 seconds total
 * Shows only in standalone PWA mode.
 */
export default function SplashScreen({ onComplete, duration = 2800 }: SplashScreenProps) {
    const [fadeOut, setFadeOut] = useState(false);
    const [show, setShow] = useState(true);

    useEffect(() => {
        // Start fade-out animation
        const fadeTimer = setTimeout(() => {
            setFadeOut(true);
        }, duration);

        // Complete removal after fade animation (500ms)
        const removeTimer = setTimeout(() => {
            setShow(false);
            onComplete?.();
        }, duration + 500);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, [duration, onComplete]);

    if (!show) return null;

    return (
        <div className={`splash-container ${fadeOut ? 'fade-out' : ''}`}>
            {/* Floating particles for depth */}
            <div className="splash-particles">
                <span className="splash-particle" />
                <span className="splash-particle" />
                <span className="splash-particle" />
                <span className="splash-particle" />
                <span className="splash-particle" />
                <span className="splash-particle" />
            </div>

            {/* Glassmorphism card */}
            <div className="splash-glass-card">
                {/* Basket with orbiting items */}
                <div className="splash-basket">
                    <img
                        src="/dist/logo.svg"
                        alt="PremaShop"
                        onError={(e) => {
                            // Fallback if logo not found
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />

                    {/* Speed lines on impact */}
                    <div className="splash-speed-lines">
                        <span className="splash-speed-line" />
                        <span className="splash-speed-line" />
                        <span className="splash-speed-line" />
                    </div>
                </div>

                {/* Orbiting grocery items */}
                <div className="splash-items">
                    <span className="splash-item">🍎</span>
                    <span className="splash-item">🍌</span>
                    <span className="splash-item">🥛</span>
                    <span className="splash-item">🍞</span>
                    <span className="splash-item">🍅</span>
                    <span className="splash-item">🥕</span>
                </div>
            </div>

            {/* Brand name - fades in after items enter */}
            <div className="splash-brand">
                <h1>PremaShop</h1>
                <p>⚡ Rapid Delivery in 14 mins</p>
            </div>
        </div>
    );
}
