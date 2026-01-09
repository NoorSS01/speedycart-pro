/**
 * Enterprise Theme System - Ambient Overlay
 * 
 * CSS-based ambient visual effects that complement the particle system.
 * These are lightweight, GPU-accelerated overlays that add atmosphere
 * without the computational cost of canvas rendering.
 * 
 * Features:
 * - Gradient washes for color atmosphere
 * - Vignette effect for depth
 * - Glow spots for warmth/mood
 * - Subtle grain texture for premium feel
 * - All reduced motion safe
 */

import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { AmbientOverlayConfig } from '@/lib/themeTokens';
import { toHSLFunction } from '@/lib/themeUtils';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AmbientOverlay() {
    const { effectiveAtmosphere, reducedMotion, theme } = useTheme();
    const overlayConfig = effectiveAtmosphere.overlay;

    // Don't render if overlay is disabled
    if (!overlayConfig.enabled) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
            aria-hidden="true"
        >
            {/* Gradient wash */}
            {overlayConfig.gradientWash && (
                <GradientWash config={overlayConfig.gradientWash} />
            )}

            {/* Vignette */}
            {overlayConfig.vignette && (
                <Vignette config={overlayConfig.vignette} />
            )}

            {/* Glow spots */}
            {overlayConfig.glowSpots && (
                <GlowSpots
                    config={overlayConfig.glowSpots}
                    animate={!reducedMotion && overlayConfig.glowSpots.animate}
                />
            )}

            {/* Grain texture */}
            {overlayConfig.grain && (
                <GrainTexture
                    config={overlayConfig.grain}
                    animate={!reducedMotion && overlayConfig.grain.animate}
                />
            )}
        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface GradientWashProps {
    config: NonNullable<AmbientOverlayConfig['gradientWash']>;
}

function GradientWash({ config }: GradientWashProps) {
    const gradient = useMemo(() => {
        const colors = config.colors.map(c => `hsl(${c})`).join(', ');
        return `linear-gradient(${config.angle}deg, ${colors})`;
    }, [config.colors, config.angle]);

    return (
        <div
            className="absolute inset-0"
            style={{
                background: gradient,
                opacity: config.opacity,
                mixBlendMode: 'soft-light',
            }}
        />
    );
}

interface VignetteProps {
    config: NonNullable<AmbientOverlayConfig['vignette']>;
}

function Vignette({ config }: VignetteProps) {
    const vignette = useMemo(() => {
        const color = `hsl(${config.color})`;
        return `radial-gradient(ellipse at center, transparent 0%, ${color} 100%)`;
    }, [config.color]);

    return (
        <div
            className="absolute inset-0"
            style={{
                background: vignette,
                opacity: config.intensity,
                mixBlendMode: 'multiply',
            }}
        />
    );
}

interface GlowSpotsProps {
    config: NonNullable<AmbientOverlayConfig['glowSpots']>;
    animate: boolean;
}

function GlowSpots({ config, animate }: GlowSpotsProps) {
    const { positions, color, radius, blur, opacity } = config;

    return (
        <>
            {positions.map((pos, index) => (
                <div
                    key={index}
                    className={animate ? 'animate-pulse' : ''}
                    style={{
                        position: 'absolute',
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        width: `${radius}px`,
                        height: `${radius}px`,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, hsl(${color}) 0%, transparent 70%)`,
                        filter: `blur(${blur}px)`,
                        opacity: opacity,
                        transform: 'translate(-50%, -50%)',
                        animationDuration: animate ? `${3000 + index * 500}ms` : undefined,
                    }}
                />
            ))}
        </>
    );
}

interface GrainTextureProps {
    config: NonNullable<AmbientOverlayConfig['grain']>;
    animate: boolean;
}

function GrainTexture({ config, animate }: GrainTextureProps) {
    // SVG noise filter for grain effect
    const svgFilter = useMemo(() => `
    <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">
      <filter id="grain-filter" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
        <feColorMatrix type="saturate" values="0"/>
        <feBlend mode="multiply" in="SourceGraphic"/>
      </filter>
    </svg>
  `, []);

    return (
        <>
            {/* Inline SVG filter definition */}
            <div
                dangerouslySetInnerHTML={{ __html: svgFilter }}
                style={{ position: 'absolute', width: 0, height: 0 }}
            />

            {/* Grain overlay */}
            <div
                className={animate ? 'animate-grain' : ''}
                style={{
                    position: 'absolute',
                    inset: '-50%',
                    width: '200%',
                    height: '200%',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    opacity: config.opacity,
                    mixBlendMode: 'overlay',
                    pointerEvents: 'none',
                }}
            />
        </>
    );
}

// =============================================================================
// CSS KEYFRAMES (to be added to index.css if using grain animation)
// =============================================================================

/*
Add to index.css if grain animation is needed:

@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-5%, -5%); }
  30% { transform: translate(3%, -8%); }
  50% { transform: translate(-7%, 5%); }
  70% { transform: translate(8%, 2%); }
  90% { transform: translate(-3%, 7%); }
}

.animate-grain {
  animation: grain 8s steps(10) infinite;
}
*/

export default AmbientOverlay;
