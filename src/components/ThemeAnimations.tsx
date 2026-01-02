import { useThemeContext } from '@/contexts/ThemeContext';
import { useEffect, useState, useMemo } from 'react';

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    delay: number;
    rotation?: number;
    sway?: number;
}

export default function ThemeAnimations() {
    const { activeTheme } = useThemeContext();
    const [particles, setParticles] = useState<Particle[]>([]);

    const particleCount = useMemo(() => {
        if (!activeTheme?.animation_type || activeTheme.animation_type === 'none') return 0;
        switch (activeTheme.animation_intensity) {
            case 'low': return 15;
            case 'medium': return 30;
            case 'high': return 50;
            default: return 25;
        }
    }, [activeTheme]);

    useEffect(() => {
        if (!activeTheme?.animation_type || activeTheme.animation_type === 'none') {
            setParticles([]);
            return;
        }

        const newParticles: Particle[] = [];
        for (let i = 0; i < particleCount; i++) {
            newParticles.push({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * -100,
                size: Math.random() * 8 + 4,
                speed: Math.random() * 3 + 2,
                opacity: Math.random() * 0.5 + 0.3,
                delay: Math.random() * 5,
                rotation: Math.random() * 360,
                sway: Math.random() * 20 - 10
            });
        }
        setParticles(newParticles);
    }, [activeTheme, particleCount]);

    if (!activeTheme?.animation_type || activeTheme.animation_type === 'none') {
        return null;
    }

    const getParticleStyle = (p: Particle): React.CSSProperties => ({
        left: `${p.x}%`,
        top: '-20px',
        width: `${p.size}px`,
        height: `${p.size}px`,
        opacity: p.opacity,
        animationDelay: `${p.delay}s`,
        animationDuration: `${8 / p.speed}s`,
        transform: `rotate(${p.rotation}deg)`
    });

    const getParticleContent = () => {
        switch (activeTheme.animation_type) {
            case 'snowfall':
                return '❄';
            case 'leaves':
                return '🍂';
            case 'rain':
                return '';
            case 'confetti':
                return '🎊';
            case 'sparkles':
                return '✨';
            case 'petals':
                return '🌸';
            default:
                return '';
        }
    };

    const getParticleClass = () => {
        const base = 'absolute pointer-events-none animate-theme-fall';
        switch (activeTheme.animation_type) {
            case 'rain':
                return `${base} w-0.5 bg-gradient-to-b from-blue-400/60 to-transparent rounded-full`;
            default:
                return base;
        }
    };

    return (
        <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden="true">
            {particles.map(p => (
                <div
                    key={p.id}
                    className={getParticleClass()}
                    style={{
                        ...getParticleStyle(p),
                        height: activeTheme.animation_type === 'rain' ? '20px' : undefined
                    }}
                >
                    {activeTheme.animation_type !== 'rain' && (
                        <span style={{ fontSize: `${p.size}px` }}>{getParticleContent()}</span>
                    )}
                </div>
            ))}
        </div>
    );
}
