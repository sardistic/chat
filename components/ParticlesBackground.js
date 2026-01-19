"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { RIPPLE_PRESETS, rippleCallbacks } from './DotGridRegistry';

/**
 * ParticlesBackground - tsParticles with grid-like dots + ripple rings overlay
 * Features: wave shadow overlay, zoom light trails, 3D hover, activity attraction, ripple effects
 */
function ParticlesBackgroundComponent({ className = '', zoomLevel = 0 }) {
    const [init, setInit] = useState(false);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const ripplesRef = useRef([]);
    const animationRef = useRef(null);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    // Ripple overlay animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animating = true;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Subscribe to ripple events
        const rippleHandler = (type, origin, color, intensity) => {
            const preset = RIPPLE_PRESETS[type] || RIPPLE_PRESETS.message;
            const ox = origin?.x ?? window.innerWidth / 2;
            const oy = origin?.y ?? window.innerHeight / 2;

            ripplesRef.current.push({
                x: ox,
                y: oy,
                radius: 0,
                speed: preset.speed,
                width: preset.width,
                maxRadius: preset.maxRadius,
                opacity: preset.opacity * (intensity || 1),
                color: color || '#ffffff'
            });

            // Push nearby particles outward from ripple origin
            const container = containerRef.current;
            if (container?.particles) {
                const particles = container.particles.array || [];
                for (const particle of particles) {
                    const dx = particle.position.x - ox;
                    const dy = particle.position.y - oy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150 && dist > 0) {
                        const force = (1 - dist / 150) * 1.5;
                        particle.velocity.x += (dx / dist) * force;
                        particle.velocity.y += (dy / dist) * force;
                    }
                }
            }
        };
        rippleCallbacks.add(rippleHandler);

        // Animation loop
        const animate = () => {
            if (!animating) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const ripples = ripplesRef.current;
            const container = containerRef.current;
            const particles = container?.particles?.array || [];

            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                const prevRadius = r.radius;
                r.radius += r.speed;

                // Push particles at the wavefront (between prev and current radius)
                for (const particle of particles) {
                    const dx = particle.position.x - r.x;
                    const dy = particle.position.y - r.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Check if particle is at the wavefront ring
                    const innerEdge = prevRadius - r.width * 0.5;
                    const outerEdge = r.radius + r.width * 0.5;

                    if (dist > innerEdge && dist < outerEdge && dist > 0) {
                        // Stronger push for particles closer to ring center
                        const ringCenter = (prevRadius + r.radius) / 2;
                        const distFromRing = Math.abs(dist - ringCenter);
                        const ringInfluence = 1 - (distFromRing / r.width);
                        const force = ringInfluence * 0.6;

                        particle.velocity.x += (dx / dist) * force;
                        particle.velocity.y += (dy / dist) * force;
                    }
                }

                // Calculate fade: starts at 60% of max radius
                const fadeStartRatio = 0.6;
                const progress = r.radius / r.maxRadius;
                const fade = progress < fadeStartRatio
                    ? 1.0
                    : 1.0 - ((progress - fadeStartRatio) / (1.0 - fadeStartRatio));

                // Draw ring
                const alpha = r.opacity * Math.max(0, fade);
                if (alpha > 0.01) {
                    ctx.beginPath();
                    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                    ctx.strokeStyle = r.color;
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = r.width * fade; // Thinner as it fades
                    ctx.stroke();
                }

                // Remove when done
                if (r.radius > r.maxRadius) {
                    ripples.splice(i, 1);
                }
            }

            ctx.globalAlpha = 1;
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            animating = false;
            cancelAnimationFrame(animationRef.current);
            window.removeEventListener('resize', resize);
            rippleCallbacks.delete(rippleHandler);
        };
    }, [init]); // Re-run when particles init

    const options = useMemo(() => ({
        fullScreen: {
            enable: true,
            zIndex: -1
        },
        background: {
            color: {
                value: "#000000",
            },
        },
        fpsLimit: 60, // Higher FPS for smoother ripple interaction
        interactivity: {
            detectsOn: "window",
            events: {
                onHover: {
                    enable: true,
                    mode: ["grab", "bubble"],
                    parallax: {
                        enable: false,
                    }
                },
                resize: {
                    enable: true,
                },
            },
            modes: {
                grab: {
                    distance: 180,
                    links: {
                        opacity: 0.15,
                        color: "#ffffff"
                    }
                },
                bubble: {
                    distance: 250,
                    size: 12,        // Larger hover size
                    duration: 0.3,
                    opacity: 0.9,    // Brighter at center
                },
            },
        },
        particles: {
            color: {
                // Pure white for consistency with DotGrid
                value: "#ffffff",
            },
            links: {
                enable: false, // Disabled for performance
                distance: 80,
                color: "#ffffff",
                opacity: 0.04,
                width: 0.3,
            },
            move: {
                enable: true,
                speed: 0.2,
                direction: "none",
                random: true,
                straight: false,
                outModes: {
                    default: "bounce",
                },
                decay: 0.015, // Velocity decay so pushed particles slow down
                trail: {
                    enable: false,
                },
            },
            number: {
                value: 400, // More particles for denser field
                density: {
                    enable: true,
                    width: 1920,
                    height: 1080,
                },
            },
            opacity: {
                value: {
                    min: 0.3,
                    max: 0.8,
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: 0.2,   // Smaller particles
                    max: 1.0,
                },
            },
        },
        detectRetina: true,
    }), []);

    const particlesLoaded = useCallback(async (container) => {
        containerRef.current = container;
    }, []);

    // Zoom states
    const isZooming = zoomLevel > 0.1;
    const zoomOpacity = zoomLevel >= 1.8 ? Math.max(0, 1 - (zoomLevel - 1.5) * 1.5) : 1;
    const zoomScale = zoomLevel > 0.01 ? 1 + zoomLevel * 0.2 : 1;
    const motionBlur = isZooming ? `blur(${zoomLevel * 2}px)` : 'none';

    // Main wrapper with zoom effects
    const wrapperStyle = useMemo(() => ({
        position: 'absolute', // Changed from fixed to respect parent stacking
        inset: 0,
        zIndex: 0, // Reset to 0 since it's now first child of isolated .app
        pointerEvents: 'none',
        opacity: zoomOpacity,
        transform: `scale(${zoomScale})`,
        filter: motionBlur,
        transition: isZooming
            ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease-out, filter 0.3s ease-out'
            : 'transform 0.4s ease-out, opacity 0.4s ease-out, filter 0.2s ease-out',
        transformOrigin: 'center center',
    }), [zoomOpacity, zoomScale, motionBlur, isZooming]);

    // Light trails overlay during zoom
    const lightTrailsStyle = useMemo(() => ({
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        opacity: isZooming ? Math.min(zoomLevel * 0.5, 0.4) : 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(255,255,255,0.03) 60%, rgba(100,150,255,0.08) 100%)',
        transform: `scale(${1 + zoomLevel * 0.5})`,
        transition: 'opacity 0.3s ease-out, transform 0.5s ease-out',
    }), [isZooming, zoomLevel]);

    if (!init) {
        return (
            <div
                className={className}
                style={{
                    ...wrapperStyle,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #0c0c16 50%, #db2777 100%)',
                }}
            />
        );
    }

    return (
        <div style={wrapperStyle}>
            <Particles
                id="tsparticles"
                className={className}
                particlesLoaded={particlesLoaded}
                options={options}
            />
            {/* Ripple canvas overlay */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}

// Memoize to prevent particle reset on parent re-renders
import { memo } from 'react';
const ParticlesBackground = memo(ParticlesBackgroundComponent);
export default ParticlesBackground;

