"use client";

import { useEffect, useRef } from 'react';
import { getTilePosition, registerTilePosition, unregisterTilePosition, RIPPLE_PRESETS, rippleCallbacks } from './DotGridRegistry';

// Just re-export the registry functions to maintain API compatibility if needed
// but locally we import them.

export default function DotGridCanvas({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const mouseRef = useRef({ x: -100, y: -100, targetX: -100, targetY: -100 });
    const zoomRef = useRef({ current: zoomLevel, target: zoomLevel, velocity: 0 });

    useEffect(() => {
        zoomRef.current.target = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let width, height;
        let gridDots = [];
        let particles = [];
        let ripples = []; // Local ripple state

        const params = {
            size: 45, // Grid spacing
            baseRadius: 1.5,
            radiusVariation: 0.5,
            baseOpacity: 0.15,
            opacityVariation: 0.1,
            waveSpeed: 0.002,
            growth: 40, // Mouse proximity growth
            proximity: 350, // Mouse proximity radius
            ease: 0.15,
            particleCount: 15,
            particleSpeed: 0.2,
            particleRadius: 1,
            particleOpacity: 0.3,
            lineDistance: 150,
            lineOpacity: 0.15,
            waveGrowth: 3, // Idle wave
            waveOpacityBoost: 0.15,
            mouseOpacityBoost: 0.6
        };

        // Ripple Class
        class Ripple {
            constructor(type = 'message', originY = null, color = '#ffffff', intensity = 1.0) {
                const preset = RIPPLE_PRESETS[type] || RIPPLE_PRESETS.message;
                this.x = width; // Start from right edge
                this.y = originY !== null ? originY : height * 0.8;
                this.radius = 0;
                this.maxRadius = width * 1.5;
                this.speed = preset.speed * 0.6; // Slower
                this.width = preset.width;
                this.growth = preset.growth * intensity;
                this.opacity = preset.opacity * intensity;
                this.alive = true;
                this.color = color;
                this.rotationOffset = Math.random() * Math.PI * 2;
            }

            update() {
                this.radius += this.speed;
                if (this.radius > this.maxRadius) this.alive = false;
            }

            getInfluence(dotX, dotY) {
                const dx = dotX - this.x;
                const dy = dotY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Broken wave noise
                const angle = Math.atan2(dy, dx) + this.rotationOffset;
                const noise = Math.sin(angle * 3) * Math.cos(angle * 5 + this.radius * 0.01);

                // Distance from ring edge
                const distFromRing = Math.abs(dist - (this.radius + noise * 50));

                if (distFromRing < this.width) {
                    // 0 to 1 based on distance from center of ring width
                    const t = 1 - (distFromRing / this.width);
                    return t * t * this.growth; // Smooth quadratic falloff
                }
                return 0;
            }
        }

        class GridDot {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.phase = Math.random() * Math.PI * 2;
                this._radius = params.baseRadius + (Math.random() * params.radiusVariation);
                this.radius = this._radius;
                this.baseOpacity = params.baseOpacity + (Math.random() * params.opacityVariation);
                this.opacity = this.baseOpacity;
                this.targetOpacity = this.baseOpacity;
                this.targetRadius = this._radius;

                // Track current vs target magnetic pull for smoothing
                this.currentMagX = 0;
                this.currentMagY = 0;
            }

            update(mouseX, mouseY, time, ripples) {
                // Wave
                const wave = Math.sin(this.x * 0.004 + this.y * 0.003 + time * params.waveSpeed + this.phase);
                const normalizedWave = (wave + 1) / 2;
                const waveGrowth = normalizedWave * params.waveGrowth;
                const waveOpacity = normalizedWave * params.waveOpacityBoost;

                // Mouse proximity
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const distSq = dx * dx + dy * dy;
                const proxSq = params.proximity * params.proximity;
                let mouseGrowth = 0;
                let mouseOpacity = 0;

                // FLUID MAGNETIC PULL
                let targetMagX = 0;
                let targetMagY = 0;

                if (distSq < proxSq) {
                    const dist = Math.sqrt(distSq);
                    const t = 1 - dist / params.proximity;
                    const falloff = t * t;
                    mouseGrowth = falloff * params.growth;
                    mouseOpacity = falloff * params.mouseOpacityBoost;

                    // "Ferrofluid" Pull
                    const pullStrength = 15 * falloff;
                    const dirX = dx / (dist || 1);
                    const dirY = dy / (dist || 1);

                    targetMagX = -dirX * pullStrength;
                    targetMagY = -dirY * pullStrength;
                }

                // Viscous smoothing
                this.currentMagX += (targetMagX - this.currentMagX) * params.ease;
                this.currentMagY += (targetMagY - this.currentMagY) * params.ease;
                const magX = this.currentMagX;
                const magY = this.currentMagY;

                // Ripple
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

                // Sizing
                let finalRadius, finalOpacity;
                if (rippleInfluence > 0.1) {
                    const waveSize = this._radius + 3 * rippleInfluence;
                    const waveOpacity = 0.8 * rippleInfluence;
                    finalRadius = waveSize;
                    finalOpacity = waveOpacity;
                } else {
                    finalRadius = this._radius + waveGrowth + mouseGrowth;
                    finalOpacity = this.baseOpacity + waveOpacity + mouseOpacity;
                }

                this.targetRadius = finalRadius;
                this.radius += (this.targetRadius - this.radius) * params.ease;

                this.targetOpacity = finalOpacity;
                this.opacity += (this.targetOpacity - this.opacity) * params.ease;

                this.drawMagX = magX;
                this.drawMagY = magY;
            }
        }

        // Particle Class ... (omitted for brevity, assume similar simple logic or implement)
        // Implementing simple Particle for completeness
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
                if (this.x < -10 || this.x > width + 10 || this.y < -10 || this.y > height + 10) this.reset();
            }
            draw(ctx, mouseX, mouseY) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
                ctx.fill();
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
            for (let i = 0; i < params.particleCount; i++) particles.push(new Particle());
        };

        // ... Listeners ...

        const handleMouseMove = (e) => {
            mouseRef.current.targetX = e.clientX;
            mouseRef.current.targetY = e.clientY;
        };

        const onRippleTrigger = (type, origin, color, intensity) => {
            // Handle origin object or Y coord for backward compat logic if needed
            // Canvas version assumed originY mostly? 
            // Let's support object
            const y = origin?.y ?? (typeof origin === 'number' ? origin : height * 0.8);
            ripples.push(new Ripple(type, y, color, intensity));
        };
        rippleCallbacks.add(onRippleTrigger);

        let time = 0;
        const animate = () => {
            time += 1;
            // ... Clean ripples
            for (let i = ripples.length - 1; i >= 0; i--) {
                ripples[i].update();
                if (!ripples[i].alive) ripples.splice(i, 1);
            }

            // Mouse ease
            const mouseEase = 0.25;
            mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * mouseEase;
            mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * mouseEase;

            ctx.clearRect(0, 0, width, height);

            const mouse = mouseRef.current;

            // Draw Dots
            for (const dot of gridDots) {
                dot.update(mouse.x, mouse.y, time, ripples);

                if (dot.opacity > 0.05 || dot.radius > 1) {
                    let r = 255, g = 255, b = 255;
                    // ... Color blend logic omitted for brevity, assuming white for now or standard

                    // FLUID RINGS (5 Layers - copied from previous implementation logic)
                    if (dot.opacity > 0.05) {
                        const mx = dot.drawMagX || 0;
                        const my = dot.drawMagY || 0;

                        // 1. Outer Ring (Max Drag, Faint)
                        const r1 = Math.max(0.5, dot.radius * 1.8);
                        ctx.beginPath();
                        ctx.arc(dot.x + mx, dot.y + my, r1, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(${r},${g},${b}, ${dot.opacity * 0.1})`;
                        ctx.stroke();

                        // 2. Mid - Outer (80% Drag)
                        const r2 = Math.max(0.5, dot.radius * 1.5);
                        ctx.beginPath();
                        ctx.arc(dot.x + mx * 0.8, dot.y + my * 0.8, r2, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(${r},${g},${b}, ${dot.opacity * 0.15})`;
                        ctx.stroke();

                        // 3. Mid (60% Drag)
                        const r3 = Math.max(0.5, dot.radius * 1.2);
                        ctx.beginPath();
                        ctx.arc(dot.x + mx * 0.6, dot.y + my * 0.6, r3, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(${r},${g},${b}, ${dot.opacity * 0.2})`;
                        ctx.stroke();

                        // 4. Mid - Inner (40% Drag)
                        const r4 = Math.max(0.5, dot.radius * 0.9);
                        ctx.beginPath();
                        ctx.arc(dot.x + mx * 0.4, dot.y + my * 0.4, r4, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(${r},${g},${b}, ${dot.opacity * 0.3})`;
                        ctx.stroke();

                        // 5. Core (20% Drag, Solid)
                        ctx.beginPath();
                        ctx.arc(dot.x + mx * 0.2, dot.y + my * 0.2, dot.radius * 0.45, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(${r},${g},${b}, ${dot.opacity})`;
                        ctx.fill();
                    }
                }
            }

            // Draw Particles
            for (const p of particles) { p.update(); p.draw(ctx, mouse.x, mouse.y); }

            animationRef.current = requestAnimationFrame(animate);
        };

        build();
        window.addEventListener('resize', build);
        window.addEventListener('mousemove', handleMouseMove);
        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
            window.removeEventListener('resize', build);
            window.removeEventListener('mousemove', handleMouseMove);
            rippleCallbacks.delete(onRippleTrigger);
        };
    }, []);

    return <canvas ref={canvasRef} className={`fixed inset - 0 pointer - events - none - z - 10 ${className} `} style={{ background: '#111' }} />;
}
