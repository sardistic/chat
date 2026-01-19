"use client";

import { useEffect, useMemo, useRef, memo } from "react";
import { RIPPLE_PRESETS, rippleCallbacks } from './DotGridRegistry';

/**
 * StarMapBackground - Custom canvas particle system with ripple interaction
 * Random star placement with hover glow and ripple effects
 */
function StarMapBackgroundComponent({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const particlesRef = useRef([]);
    const ripplesRef = useRef([]);
    const mousePosRef = useRef({ x: -1000, y: -1000 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;

        // Initialize particles (stars)
        const initParticles = () => {
            const count = 1200;
            particlesRef.current = [];
            for (let i = 0; i < count; i++) {
                particlesRef.current.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    baseX: 0,
                    baseY: 0,
                    vx: 0,
                    vy: 0,
                    size: 0.3 + Math.random() * 1.2,
                    baseSize: 0.3 + Math.random() * 1.2,
                    opacity: 0.3 + Math.random() * 0.5,
                    twinklePhase: Math.random() * Math.PI * 2,
                    twinkleSpeed: 0.01 + Math.random() * 0.02,
                    glow: 0, // Light effect when hit by ripple
                });
            }
            particlesRef.current.forEach(p => {
                p.baseX = p.x;
                p.baseY = p.y;
            });
        };

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            initParticles();
        };
        resize();
        window.addEventListener('resize', resize);

        // Mouse tracking
        const handleMouseMove = (e) => {
            mousePosRef.current.x = e.clientX;
            mousePosRef.current.y = e.clientY;
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Subscribe to ripple events
        const rippleHandler = (type, origin, color, intensity) => {
            const preset = RIPPLE_PRESETS[type] || RIPPLE_PRESETS.message;
            ripplesRef.current.push({
                x: origin?.x ?? width / 2,
                y: origin?.y ?? height / 2,
                radius: 0,
                speed: preset.speed,
                width: preset.width,
                maxRadius: preset.maxRadius,
                opacity: preset.opacity * (intensity || 1),
                color: color || '#ffffff'
            });
        };
        rippleCallbacks.add(rippleHandler);

        const animate = () => {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            const particles = particlesRef.current;
            const ripples = ripplesRef.current;
            const mouse = mousePosRef.current;

            for (const p of particles) {
                // Twinkle effect
                p.twinklePhase += p.twinkleSpeed;
                const twinkle = 0.7 + 0.3 * Math.sin(p.twinklePhase);

                // Decay glow
                p.glow *= 0.92;

                // Motion glow - particles in motion emit light
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                const motionGlow = Math.min(1.0, speed * 0.2);

                // Apply ripple forces
                for (const r of ripples) {
                    const dx = p.x - r.x;
                    const dy = p.y - r.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    const innerEdge = r.radius - r.width;
                    const outerEdge = r.radius + r.width;

                    if (dist > innerEdge && dist < outerEdge && dist > 0) {
                        const distFromRing = Math.abs(dist - r.radius);
                        const influence = Math.max(0, 1 - distFromRing / r.width);
                        const force = influence * 2.5;

                        p.vx += (dx / dist) * force;
                        p.vy += (dy / dist) * force;

                        // Light up particle when hit
                        p.glow = Math.min(1, p.glow + influence * 0.8);
                    }
                }

                // Apply velocity with damping
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.95;
                p.vy *= 0.95;

                // Gentle drift back to base position
                p.x += (p.baseX - p.x) * 0.002;
                p.y += (p.baseY - p.y) * 0.002;

                // Wrap around edges
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                // Mouse hover effect - grow particles near cursor
                const mouseDx = p.x - mouse.x;
                const mouseDy = p.y - mouse.y;
                const mouseDist = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
                const hoverRadius = 180;
                let hoverScale = 1;
                let hoverGlow = 0;
                if (mouseDist < hoverRadius) {
                    const t = 1 - mouseDist / hoverRadius;
                    hoverScale = 1 + t * 4; // Grow up to 5x
                    hoverGlow = t * 0.5;
                }

                // Calculate final size and brightness
                const finalSize = p.baseSize * hoverScale * (1 + p.glow * 0.5 + motionGlow * 0.3);
                const glowBrightness = Math.min(1, p.opacity * twinkle + p.glow * 0.6 + hoverGlow + motionGlow);

                // Draw particle with glow effect
                if (p.glow > 0.05 || hoverGlow > 0.05 || motionGlow > 0.05) {
                    // Outer glow - larger and brighter
                    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, finalSize * 5);
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${glowBrightness * 0.7})`);
                    gradient.addColorStop(0.3, `rgba(200, 220, 255, ${glowBrightness * 0.4})`);
                    gradient.addColorStop(0.6, `rgba(150, 180, 255, ${glowBrightness * 0.15})`);
                    gradient.addColorStop(1, 'rgba(150, 180, 255, 0)');
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, finalSize * 5, 0, Math.PI * 2);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }

                // Core particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, finalSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${glowBrightness})`;
                ctx.fill();
            }

            // Update ripples (invisible, just for particle interaction)
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;
                if (r.radius > r.maxRadius) {
                    ripples.splice(i, 1);
                }
            }

            animationRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            rippleCallbacks.delete(rippleHandler);
        };
    }, []);

    // Zoom effects
    const isZooming = zoomLevel > 0.1;
    const zoomOpacity = zoomLevel >= 1.8 ? Math.max(0, 1 - (zoomLevel - 1.5) * 1.5) : 1;
    const zoomScale = zoomLevel > 0.01 ? 1 + zoomLevel * 0.2 : 1;
    const motionBlur = isZooming ? `blur(${zoomLevel * 2}px)` : 'none';

    const wrapperStyle = useMemo(() => ({
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: zoomOpacity,
        transform: `scale(${zoomScale})`,
        filter: motionBlur,
        transition: isZooming
            ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease-out'
            : 'transform 0.4s ease-out, opacity 0.4s ease-out',
        transformOrigin: 'center center',
    }), [zoomOpacity, zoomScale, motionBlur, isZooming]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={wrapperStyle}
        />
    );
}

const StarMapBackground = memo(StarMapBackgroundComponent);
export default StarMapBackground;
