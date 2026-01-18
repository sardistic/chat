"use client";

import { useEffect, useRef } from 'react';

/**
 * DotGrid - Animated dot grid with proximity growth + wave effects + floating particles
 * Features: Fast mouse response, prominent waves
 */
export default function DotGrid({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });
    const animationRef = useRef(null);
    const zoomRef = useRef({ current: zoomLevel, target: zoomLevel, velocity: 0 });

    useEffect(() => {
        zoomRef.current.target = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Parameters - tuned for responsiveness and visibility
        const params = {
            // Grid
            size: 48,
            baseRadius: 0.8,         // Larger base for visibility
            radiusVariation: 0.3,
            proximity: 350,          // Larger area of influence
            growth: 20,              // BIG dots near mouse - almost touching
            ease: 0.18,              // Fast easing for responsiveness

            // Opacity
            baseOpacity: 0.12,
            opacityVariation: 0.08,
            maxOpacity: 0.85,
            mouseOpacityBoost: 0.7,

            // Wave animations - MORE PROMINENT
            waveSpeed: 0.025,        // Faster waves
            waveGrowth: 2.5,         // Strong wave size effect
            waveOpacityBoost: 0.25,

            // RNG Energy bursts
            burstChance: 0.00003,
            burstDuration: 80,
            burstGrowth: 2.5,
            burstOpacity: 0.2,

            // Floating particles
            particleCount: 12,
            particleRadius: 0.5,
            particleOpacity: 0.12,
            particleSpeed: 0.15,
            lineDistance: 80,
            lineOpacity: 0.04,
        };

        let gridDots = [];
        let particles = [];
        let width, height;

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

                this.burstTimer = 0;
                this.burstIntensity = 0;
            }

            update(mouseX, mouseY, time) {
                // Wave contribution - multiple overlapping waves for organic motion
                const wave1 = Math.sin(this.x * 0.005 + this.y * 0.004 + time * params.waveSpeed);
                const wave2 = Math.sin(this.x * 0.003 - this.y * 0.005 + time * params.waveSpeed * 1.3 + this.phase);
                const wave3 = Math.sin((this.x + this.y) * 0.003 + time * params.waveSpeed * 0.7 + this.wavePhase);
                const wave4 = Math.sin(this.y * 0.006 + time * params.waveSpeed * 0.9);
                const waveValue = (wave1 * 0.35 + wave2 * 0.25 + wave3 * 0.25 + wave4 * 0.15);
                const normalizedWave = (waveValue + 1) / 2;

                const waveGrowth = normalizedWave * params.waveGrowth;
                const waveOpacity = normalizedWave * params.waveOpacityBoost;

                // Mouse proximity - simple smooth falloff for speed
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                let mouseGrowth = 0;
                let mouseOpacity = 0;

                if (distance < params.proximity) {
                    // Smooth quadratic falloff - fast to compute
                    const t = 1 - (distance / params.proximity);
                    const falloff = t * t * (3 - 2 * t); // smoothstep
                    mouseGrowth = falloff * params.growth;
                    mouseOpacity = falloff * params.mouseOpacityBoost;
                }

                // RNG Energy burst
                if (this.burstTimer > 0) {
                    this.burstTimer--;
                    this.burstIntensity = (this.burstTimer / params.burstDuration) * params.burstGrowth;
                } else if (Math.random() < params.burstChance) {
                    this.burstTimer = params.burstDuration;
                    this.burstIntensity = params.burstGrowth;
                }

                // Fast easing
                this.targetRadius = this._radius + waveGrowth + mouseGrowth + this.burstIntensity;
                this.radius += (this.targetRadius - this.radius) * params.ease;

                this.targetOpacity = this.baseOpacity + waveOpacity + mouseOpacity +
                    (this.burstIntensity / params.burstGrowth) * params.burstOpacity;
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

        let time = 0;
        const animate = () => {
            time += 1;

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
                dot.update(mouse.x, mouse.y, time);
            }

            // Draw dots
            for (const dot of gridDots) {
                if (dot.opacity > 0.05 || dot.radius > 1) {
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, Math.max(0.3, dot.radius), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(params.maxOpacity, dot.opacity)})`;
                    ctx.fill();
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
