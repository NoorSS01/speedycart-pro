/**
 * Enterprise Theme System - Atmosphere Canvas
 * 
 * A performant canvas-based particle rendering system that replaces
 * the emoji-based ThemeAnimations component. Features:
 * 
 * - Hardware-accelerated canvas rendering
 * - Automatic FPS monitoring and quality degradation
 * - Pause when tab is hidden
 * - Respect reduced motion preferences
 * - Support for multiple particle types
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ParticleType, ParticleConfig } from '@/lib/themeTokens';
import { parseHSL } from '@/lib/themeUtils';

// =============================================================================
// TYPES
// =============================================================================

interface Particle {
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    rotation: number;
    rotationSpeed: number;
    drift: number;
    driftPhase: number;
    hueOffset: number;
}

interface CanvasContextRef {
    ctx: CanvasRenderingContext2D | null;
    particles: Particle[];
    animationId: number | null;
    lastFrameTime: number;
    frameCount: number;
    fps: number;
    isVisible: boolean;
}

// =============================================================================
// PARTICLE FACTORY
// =============================================================================

function createParticle(config: ParticleConfig, canvasWidth: number): Particle {
    return {
        x: Math.random() * canvasWidth,
        y: -20 - Math.random() * 100, // Start above viewport
        size: config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin),
        speed: config.speedMin + Math.random() * (config.speedMax - config.speedMin),
        opacity: config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin),
        rotation: config.rotation ? Math.random() * 360 : 0,
        rotationSpeed: config.rotation ? (Math.random() - 0.5) * config.rotationSpeed * 2 : 0,
        drift: config.drift,
        driftPhase: Math.random() * Math.PI * 2,
        hueOffset: (Math.random() - 0.5) * config.colorVariance * 2,
    };
}

// =============================================================================
// PARTICLE RENDERERS
// =============================================================================

function renderSnowflake(
    ctx: CanvasRenderingContext2D,
    particle: Particle,
    baseColor: { h: number; s: number; l: number }
) {
    const { x, y, size, opacity, hueOffset } = particle;

    const h = (baseColor.h + hueOffset + 360) % 360;
    ctx.fillStyle = `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, ${opacity})`;

    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Add subtle glow
    ctx.shadowBlur = size;
    ctx.shadowColor = `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, ${opacity * 0.5})`;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function renderRaindrop(
    ctx: CanvasRenderingContext2D,
    particle: Particle,
    baseColor: { h: number; s: number; l: number }
) {
    const { x, y, size, opacity, hueOffset } = particle;

    const h = (baseColor.h + hueOffset + 360) % 360;
    const gradient = ctx.createLinearGradient(x, y - size * 4, x, y);
    gradient.addColorStop(0, `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, 0)`);
    gradient.addColorStop(1, `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, ${opacity})`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = size / 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y - size * 4);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function renderPetal(
    ctx: CanvasRenderingContext2D,
    particle: Particle,
    baseColor: { h: number; s: number; l: number }
) {
    const { x, y, size, opacity, rotation, hueOffset } = particle;

    const h = (baseColor.h + hueOffset + 360) % 360;
    ctx.fillStyle = `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, ${opacity})`;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);

    // Draw petal shape (ellipse)
    ctx.beginPath();
    ctx.ellipse(0, 0, size / 2, size, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function renderLeaf(
    ctx: CanvasRenderingContext2D,
    particle: Particle,
    baseColor: { h: number; s: number; l: number }
) {
    const { x, y, size, opacity, rotation, hueOffset } = particle;

    // Autumn colors - shift hue toward orange/red
    const h = (baseColor.h + hueOffset + 360) % 360;
    ctx.fillStyle = `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, ${opacity})`;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);

    // Draw leaf shape
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size / 2, -size / 2, size / 2, size / 2, 0, size);
    ctx.bezierCurveTo(-size / 2, size / 2, -size / 2, -size / 2, 0, -size);
    ctx.fill();

    ctx.restore();
}

function renderSparkle(
    ctx: CanvasRenderingContext2D,
    particle: Particle,
    baseColor: { h: number; s: number; l: number },
    time: number
) {
    const { x, y, size, opacity, hueOffset, driftPhase } = particle;

    // Twinkle effect using time
    const twinkle = 0.5 + 0.5 * Math.sin(time * 0.005 + driftPhase);
    const h = (baseColor.h + hueOffset + 360) % 360;

    ctx.fillStyle = `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, ${opacity * twinkle})`;
    ctx.shadowBlur = size * 2;
    ctx.shadowColor = `hsla(${h}, ${baseColor.s}%, ${baseColor.l}%, ${opacity * twinkle})`;

    // Draw star shape
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const innerRadius = size / 4;
        const outerRadius = size;

        ctx.lineTo(
            x + Math.cos(angle) * outerRadius,
            y + Math.sin(angle) * outerRadius
        );
        ctx.lineTo(
            x + Math.cos(angle + Math.PI / 4) * innerRadius,
            y + Math.sin(angle + Math.PI / 4) * innerRadius
        );
    }
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
}

function renderConfetti(
    ctx: CanvasRenderingContext2D,
    particle: Particle,
    baseColor: { h: number; s: number; l: number }
) {
    const { x, y, size, opacity, rotation, hueOffset } = particle;

    const h = (baseColor.h + hueOffset + 360) % 360;
    ctx.fillStyle = `hsla(${h}, 90%, 60%, ${opacity})`;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);

    // Draw rectangular confetti
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);

    ctx.restore();
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AtmosphereCanvas() {
    const { effectiveAtmosphere, reducedMotion, theme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasContextRef>({
        ctx: null,
        particles: [],
        animationId: null,
        lastFrameTime: 0,
        frameCount: 0,
        fps: 60,
        isVisible: true,
    });
    const [degraded, setDegraded] = useState(false);

    const particleConfig = effectiveAtmosphere.particles;
    const shouldRender = particleConfig.type !== 'none' && !reducedMotion;

    // Parse base color
    const baseColor = parseHSL(particleConfig.color) || { h: 0, s: 0, l: 100 };

    // Initialize particles
    const initParticles = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !shouldRender) return;

        const density = degraded
            ? Math.floor(particleConfig.density * 0.3)
            : particleConfig.density;

        const particles: Particle[] = [];
        for (let i = 0; i < density; i++) {
            particles.push(createParticle(particleConfig, canvas.width));
        }

        contextRef.current.particles = particles;
    }, [particleConfig, shouldRender, degraded]);

    // Update particle positions
    const updateParticles = useCallback((deltaTime: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { particles } = contextRef.current;
        const dt = deltaTime / 16.67; // Normalize to 60fps

        particles.forEach((p, index) => {
            // Vertical movement
            p.y += p.speed * dt * 0.1;

            // Horizontal drift (sinusoidal)
            p.driftPhase += 0.02 * dt;
            p.x += Math.sin(p.driftPhase) * p.drift * 0.1;

            // Rotation
            p.rotation += p.rotationSpeed * dt;

            // Reset if off screen
            if (p.y > canvas.height + 50 || p.x < -50 || p.x > canvas.width + 50) {
                const newParticle = createParticle(particleConfig, canvas.width);
                particles[index] = newParticle;
            }
        });
    }, [particleConfig]);

    // Render frame
    const render = useCallback((time: number) => {
        const canvas = canvasRef.current;
        const { ctx, particles, lastFrameTime, isVisible } = contextRef.current;

        if (!canvas || !ctx || !isVisible || !shouldRender) return;

        const deltaTime = time - lastFrameTime;
        contextRef.current.lastFrameTime = time;

        // FPS monitoring
        contextRef.current.frameCount++;
        if (contextRef.current.frameCount % 60 === 0) {
            const currentFps = 1000 / deltaTime;
            contextRef.current.fps = currentFps;

            // Auto-degrade if FPS drops too low
            if (currentFps < 30 && !degraded) {
                setDegraded(true);
            }
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update particles
        updateParticles(deltaTime);

        // Render particles
        particles.forEach(particle => {
            switch (particleConfig.type) {
                case 'snowfall':
                    renderSnowflake(ctx, particle, baseColor);
                    break;
                case 'rain':
                    renderRaindrop(ctx, particle, baseColor);
                    break;
                case 'petals':
                    renderPetal(ctx, particle, baseColor);
                    break;
                case 'leaves':
                    renderLeaf(ctx, particle, baseColor);
                    break;
                case 'sparkles':
                    renderSparkle(ctx, particle, baseColor, time);
                    break;
                case 'confetti':
                    renderConfetti(ctx, particle, baseColor);
                    break;
            }
        });

        // Request next frame
        contextRef.current.animationId = requestAnimationFrame(render);
    }, [shouldRender, particleConfig.type, baseColor, updateParticles, degraded]);

    // Handle visibility change
    useEffect(() => {
        const handleVisibility = () => {
            contextRef.current.isVisible = document.visibilityState === 'visible';

            if (contextRef.current.isVisible && shouldRender) {
                contextRef.current.animationId = requestAnimationFrame(render);
            } else if (contextRef.current.animationId) {
                cancelAnimationFrame(contextRef.current.animationId);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [render, shouldRender]);

    // Initialize canvas and start animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !shouldRender) return;

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Get context
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        contextRef.current.ctx = ctx;
        contextRef.current.lastFrameTime = performance.now();

        // Start animation
        contextRef.current.animationId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (contextRef.current.animationId) {
                cancelAnimationFrame(contextRef.current.animationId);
            }
        };
    }, [shouldRender, initParticles, render]);

    // Reinitialize when config changes
    useEffect(() => {
        initParticles();
    }, [particleConfig, initParticles]);

    // Don't render if no effect needed
    if (!shouldRender) {
        return null;
    }

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[1]"
            aria-hidden="true"
            style={{
                opacity: degraded ? 0.7 : 1,
                transition: 'opacity 0.5s ease',
            }}
        />
    );
}

export default AtmosphereCanvas;
