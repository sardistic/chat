"use client";

import { useEffect, useMemo, useState, useRef, memo } from "react";
import { RIPPLE_PRESETS, rippleCallbacks } from './DotGridRegistry';

/**
 * ParticlesBackground - Custom canvas particle system with ripple interaction
 * Stars/particles get pushed outward as ripple waves pass through them
 */
function ParticlesBackgroundComponent({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const particlesRef = useRef([]);
    const ripplesRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;

        // Initialize particles (stars)
        const initParticles = () => {
            const count = 1200; // Many more particles
            particlesRef.current = [];
            for (let i = 0; i < count; i++) {
                particlesRef.current.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    baseX: 0, // Will be set after
                    baseY: 0,
                    vx: 0,
                    vy: 0,
                    size: 0.3 + Math.random() * 1.2,
                    opacity: 0.3 + Math.random() * 0.5,
                    twinklePhase: Math.random() * Math.PI * 2,
                    twinkleSpeed: 0.01 + Math.random() * 0.02,
                });
            }
            // Store base positions for drift
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

        let time = 0;
        const animate = () => {
            time += 1;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            const particles = particlesRef.current;
            const ripples = ripplesRef.current;

            // Update and draw particles
            for (const p of particles) {
                // Twinkle effect
                p.twinklePhase += p.twinkleSpeed;
                const twinkle = 0.7 + 0.3 * Math.sin(p.twinklePhase);

                // Apply ripple forces
                for (const r of ripples) {
                    const dx = p.x - r.x;
                    const dy = p.y - r.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Check if particle is at the ripple wavefront
                    const innerEdge = r.radius - r.width;
                    const outerEdge = r.radius + r.width;

                    if (dist > innerEdge && dist < outerEdge && dist > 0) {
                        // How close to ring center
                        const distFromRing = Math.abs(dist - r.radius);
                        const influence = Math.max(0, 1 - distFromRing / r.width);
                        const force = influence * 2.5; // Push strength

                        p.vx += (dx / dist) * force;
                        p.vy += (dy / dist) * force;
                    }
                }

                // Apply velocity with damping
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.95; // Damping
                p.vy *= 0.95;

                // Gentle drift back to base position
                p.x += (p.baseX - p.x) * 0.002;
                p.y += (p.baseY - p.y) * 0.002;

                // Wrap around edges
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                // Draw particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * twinkle})`;
                ctx.fill();
            }

            // Update ripples (no visible ring, just particle interaction)
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;

                // Remove finished ripples
                if (r.radius > r.maxRadius) {
                    ripples.splice(i, 1);
                }
            }
        }

        // Mouse hover effect
        animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Mouse interaction - particles grow near cursor
    const mousePos = { x: -1000, y: -1000 };
    const handleMouseMove = (e) => {
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Enhance draw loop to include hover effect
    const originalAnimate = animate;

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

const ParticlesBackground = memo(ParticlesBackgroundComponent);
export default ParticlesBackground;
