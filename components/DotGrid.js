"use client";

import { useEffect, useRef } from 'react';

// Global event system for triggering ripples from anywhere
const rippleCallbacks = new Set();

// Tile position registry - maps username to { x, y } center coordinates
const tilePositions = new Map();
export function registerTilePosition(username, x, y) {
    tilePositions.set(username, { x, y });
    console.log(`[TilePos] Registered ${username} at (${Math.round(x)}, ${Math.round(y)})`);
}
export function unregisterTilePosition(username) {
    tilePositions.delete(username);
}
export function getTilePosition(username) {
    const pos = tilePositions.get(username);
    console.log(`[TilePos] Lookup ${username}: ${pos ? `(${Math.round(pos.x)}, ${Math.round(pos.y)})` : 'not found'}`);
    return pos || null;
}

// Intensity presets - tuned for visible wave effect
const RIPPLE_PRESETS = {
    keystroke: { speed: 60, width: 200, growth: 1, opacity: 0.15 },
    typing: { speed: 55, width: 300, growth: 1.5, opacity: 0.2 },
    message: { speed: 45, width: 400, growth: 3, opacity: 0.4 },
    system: { speed: 50, width: 350, growth: 2, opacity: 0.3 },
};

export function triggerDotRipple(type = 'message', origin = null, color = '#ffffff', intensity = 1.0) {
    // type: 'keystroke', 'typing', 'message', 'system'
    // origin: { x, y } coordinates, or null for default (bottom-right)
    // color: hex color for the ripple tint
    // intensity: 0-1 multiplier for effect strength
    console.log(`[Ripple] type=${type} origin=${JSON.stringify(origin)} color=${color}`);
    rippleCallbacks.forEach(cb => cb(type, origin, color, intensity));
}

/**
 * DotGrid - Animated dot grid with proximity growth + wave effects + event ripples
 * Features: Fast mouse response, event-triggered ripples (right→left)
 */
export default function DotGrid({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });
    const animationRef = useRef(null);
    const zoomRef = useRef({ current: zoomLevel, target: zoomLevel, velocity: 0 });
    const ripplesRef = useRef([]);

    useEffect(() => {
        zoomRef.current.target = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Parameters - PERFORMANCE OPTIMIZED
        const params = {
            // Grid
            size: 48,
            baseRadius: 0.2,         // TINY base dots
            radiusVariation: 0.1,
            proximity: 300,          // Tighter area
            growth: 22,              // HUGE at cursor
            ease: 0.22,              // Faster snap

            // Opacity - BRIGHT WHITE
            baseOpacity: 0.25,       // More visible base
            opacityVariation: 0.1,
            maxOpacity: 1.0,         // Pure white at max
            mouseOpacityBoost: 0.75,

            // Wave animations - simplified
            waveSpeed: 0.015,
            waveGrowth: 0.8,         // Very subtle
            waveOpacityBoost: 0.08,

            // Event ripples - INSTANT and SUBTLE
            rippleSpeed: 40,         // Near-instant sweep
            rippleWidth: 400,        // Wide band for smooth look
            rippleGrowth: 2,         // Very subtle size boost
            rippleOpacity: 0.2,      // Gentle opacity boost

            // Floating particles - reduced
            particleCount: 6,
            particleRadius: 0.3,
            particleOpacity: 0.08,
            particleSpeed: 0.1,
            lineDistance: 60,
            lineOpacity: 0.02,
        };

        let gridDots = [];
        let particles = [];
        let width, height;
        const ripples = ripplesRef.current;

        // Ripple class - colored, expanding ring from origin
        class Ripple {
            constructor(type = 'message', origin = null, color = '#ffffff', intensity = 1.0) {
                // Origin: use provided {x, y} or default to bottom-right corner
                this.originX = origin?.x ?? width;
                this.originY = origin?.y ?? height * 0.85;
                this.radius = 0;
                this.type = type;
                this.color = color;
                this.intensity = Math.min(1, Math.max(0, intensity));
                this.alive = true;

                // Get preset or default
                const preset = RIPPLE_PRESETS[type] || RIPPLE_PRESETS.message;
                this.speed = preset.speed * this.intensity;
                this.width = preset.width;
                this.growthMult = preset.growth * this.intensity;
                this.opacityMult = preset.opacity * this.intensity;

                // Random rotation for variety in broken waves
                this.rotationOffset = Math.random() * Math.PI * 2;
            }

            update() {
                this.radius += this.speed;
                const maxDist = Math.sqrt(width * width + height * height);
                if (this.radius > maxDist + this.width) {
                    this.alive = false;
                }
            }

            getInfluence(dotX, dotY) {
                const dx = dotX - this.originX;
                const dy = dotY - this.originY;
                const dotDist = Math.sqrt(dx * dx + dy * dy);

                const distFromRing = Math.abs(dotDist - this.radius);
                if (distFromRing > this.width) return 0;

                // Base influence from distance to ring
                const t = 1 - (distFromRing / this.width);
                let influence = t * t;

                // Broken wave: use angle-based noise to create gaps
                const angle = Math.atan2(dy, dx) + this.rotationOffset;
                // Create 4-6 segments with gaps
                const segments = 5;
                const wavePattern = Math.sin(angle * segments + this.radius * 0.02);
                // Only show ~60% of the wave (gaps when pattern < -0.2)
                if (wavePattern < -0.2) {
                    influence *= 0.1; // Dim but not invisible in gaps
                } else {
                    // Boost visible segments
                    influence *= 0.8 + wavePattern * 0.4;
                }

                return Math.max(0, influence);
            }
        }

        // Grid dot class
        class GridDot {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.phase = Math.random() * Math.PI * 2;
                this.wavePhase = Math.random() * Math.PI * 2;

                this._radius = params.baseRadius + (Math.random() * params.radiusVariation);
                this.radius = this._radius;
                this.baseOpacity = params.baseOpacity + (Math.random() * params.opacityVariation);
                this.opacity = this.baseOpacity;
                this.targetOpacity = this.baseOpacity;
                this.targetRadius = this._radius;
            }

            update(mouseX, mouseY, time, ripples) {
                // Simple single wave for performance
                const wave = Math.sin(this.x * 0.004 + this.y * 0.003 + time * params.waveSpeed + this.phase);
                const normalizedWave = (wave + 1) / 2;

                const waveGrowth = normalizedWave * params.waveGrowth;
                const waveOpacity = normalizedWave * params.waveOpacityBoost;

                // Mouse proximity - simple smooth falloff
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const distSq = dx * dx + dy * dy;
                const proxSq = params.proximity * params.proximity;
                let mouseGrowth = 0;
                let mouseOpacity = 0;

                if (distSq < proxSq) {
                    const t = 1 - Math.sqrt(distSq) / params.proximity;
                    const falloff = t * t;
                    mouseGrowth = falloff * params.growth;
                    mouseOpacity = falloff * params.mouseOpacityBoost;
                }

                // Event ripple influence - WAVE EFFECT (overrides, doesn't add)
                let rippleInfluence = 0;
                let rippleColorBlend = null;
                for (const ripple of ripples) {
                    const influence = ripple.getInfluence(this.x, this.y);
                    if (influence > rippleInfluence) {
                        rippleInfluence = influence;
                        rippleColorBlend = ripple.color;
                    }
                }
                this.rippleColor = rippleColorBlend;
                this.rippleInfluence = rippleInfluence;

                // Wave effect: ripple OVERRIDES size, creating sharp wave front
                let finalRadius, finalOpacity;
                if (rippleInfluence > 0.1) {
                    // In wave: enlarged dots
                    const waveSize = this._radius + 3 * rippleInfluence;
                    const waveOpacity = 0.8 * rippleInfluence;
                    finalRadius = waveSize;
                    finalOpacity = waveOpacity;
                } else {
                    // Outside wave: normal size with mouse/wave effects
                    finalRadius = this._radius + waveGrowth + mouseGrowth;
                    finalOpacity = this.baseOpacity + waveOpacity + mouseOpacity;
                }

                // Fast easing
                this.targetRadius = finalRadius;
                this.radius += (this.targetRadius - this.radius) * params.ease;

                this.targetOpacity = finalOpacity;
                this.opacity += (this.targetOpacity - this.opacity) * params.ease;
            }
        }

        // Floating particle
        class Particle {
            constructor() {
                this.reset(true);
            }

            reset(initial = false) {
                this.x = initial ? Math.random() * width : (Math.random() < 0.5 ? 0 : width);
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * params.particleSpeed;
                this.vy = (Math.random() - 0.5) * params.particleSpeed;
                this.radius = params.particleRadius + Math.random() * 0.4;
                this.opacity = params.particleOpacity + Math.random() * 0.08;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < -10 || this.x > width + 10 || this.y < -10 || this.y > height + 10) {
                    this.reset();
                }
            }

            draw(ctx, mouseX, mouseY) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
                ctx.fill();

                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < params.lineDistance && mouseX > 0) {
                    const lineOpacity = (1 - distance / params.lineDistance) * params.lineOpacity;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(mouseX, mouseY);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        const build = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;

            gridDots = [];
            const columns = Math.ceil(width / params.size) + 1;
            const rows = Math.ceil(height / params.size) + 1;
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < columns; col++) {
                    gridDots.push(new GridDot(col * params.size, row * params.size));
                }
            }

            particles = [];
            for (let i = 0; i < params.particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const handleMouseMove = (e) => {
            mouseRef.current.targetX = e.clientX;
            mouseRef.current.targetY = e.clientY;
        };

        // Register ripple trigger callback
        const onRippleTrigger = (type, originY, color, intensity) => {
            ripples.push(new Ripple(type, originY, color, intensity));
        };
        rippleCallbacks.add(onRippleTrigger);

        let time = 0;
        const animate = () => {
            time += 1;

            // Update ripples
            for (let i = ripples.length - 1; i >= 0; i--) {
                ripples[i].update();
                if (!ripples[i].alive) {
                    ripples.splice(i, 1);
                }
            }

            // Smooth mouse interpolation for even more responsive feel
            const mouseEase = 0.25;
            mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * mouseEase;
            mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * mouseEase;

            // Smooth zoom easing
            const zoomState = zoomRef.current;
            const zoomDiff = zoomState.target - zoomState.current;
            zoomState.velocity += zoomDiff * 0.02;
            zoomState.velocity *= 0.85;
            zoomState.current += zoomState.velocity;

            const zoom = zoomState.current;
            const globalOpacity = zoom >= 1.8 ? Math.max(0, 1 - (zoom - 1.5) * 1.5) : 1;

            ctx.clearRect(0, 0, width, height);

            if (globalOpacity <= 0) {
                animationRef.current = requestAnimationFrame(animate);
                return;
            }

            const mouse = mouseRef.current;

            // Apply zoom transform
            if (zoom > 0.01) {
                const scale = 1 + zoom * 0.2;
                const centerX = width / 2;
                const centerY = height / 2;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.scale(scale, scale);
                ctx.translate(-centerX, -centerY);
                ctx.globalAlpha = globalOpacity;
            }

            // Update all dots
            for (const dot of gridDots) {
                dot.update(mouse.x, mouse.y, time, ripples);
            }

            // Draw dots
            for (const dot of gridDots) {
                if (dot.opacity > 0.05 || dot.radius > 1) {
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, Math.max(0.3, dot.radius), 0, Math.PI * 2);

                    // Blend white with ripple color based on influence
                    let r = 255, g = 255, b = 255;
                    if (dot.rippleColor && dot.rippleInfluence > 0.1 && dot.rippleColor !== '#ffffff') {
                        // Parse hex color
                        const hex = dot.rippleColor.replace('#', '');
                        const cr = parseInt(hex.substr(0, 2), 16) || 255;
                        const cg = parseInt(hex.substr(2, 2), 16) || 255;
                        const cb = parseInt(hex.substr(4, 2), 16) || 255;
                        // Influence determines how much of the user color we blend in (0.9 = 90% user color)
                        const mix = Math.min(1, dot.rippleInfluence * 0.9);
                        r = Math.round(255 * (1 - mix) + cr * mix);
                        g = Math.round(255 * (1 - mix) + cg * mix);
                        b = Math.round(255 * (1 - mix) + cb * mix);
                    }

                    // Main Dot
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dot.opacity})`;
                    ctx.fill();

                    // Inner Dot "Shadow" (Nested) - slight depth effect
                    // Only draw if big enough to be visible
                    if (dot.radius > 1.5) {
                        ctx.beginPath();
                        ctx.arc(dot.x, dot.y, dot.radius * 0.35, 0, Math.PI * 2);
                        // Darker/distinct inner core
                        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dot.opacity + 0.3})`;
                        ctx.fill();
                    }
                }
            }

            // Draw floating particles
            for (const particle of particles) {
                particle.update();
                particle.draw(ctx, mouse.x, mouse.y);
            }

            if (zoom > 0.01) {
                ctx.restore();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        build();
        window.addEventListener('resize', build);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', (e) => {
            mouseRef.current.targetX = e.touches[0].clientX;
            mouseRef.current.targetY = e.touches[0].clientY;
        });
        animate();

        return () => {
            window.removeEventListener('resize', build);
            window.removeEventListener('mousemove', handleMouseMove);
            rippleCallbacks.delete(onRippleTrigger);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100%',
                minHeight: '100vh',
                zIndex: -1,
                pointerEvents: 'none',
                background: '#000000',
            }}
        />
    );
}
