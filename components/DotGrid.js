"use client";

import { useEffect, useRef } from 'react';

/**
 * DotGrid - Animated dot grid with proximity growth + wave effects + floating particles
 * Parameters tuned closer to CodePen reference with RNG energy bursts
 */
export default function DotGrid({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animationRef = useRef(null);
    const zoomRef = useRef({ current: zoomLevel, target: zoomLevel, velocity: 0 });

    useEffect(() => {
        // Smooth zoom transition with easing
        zoomRef.current.target = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Parameters - smaller dots, more wave, less RNG
        const params = {
            // Grid
            size: 28,
            baseRadius: 0.5,      // Smaller dots
            proximity: 160,
            growth: 12,           // Less growth on hover
            ease: 0.055,

            // Dark aesthetic
            baseOpacity: 0.03,
            maxOpacity: 0.7,

            // Wave animations - MORE PROMINENT
            waveSpeed: 0.003,     // Faster waves
            waveGrowth: 2.5,      // Stronger wave effect on size
            waveOpacityBoost: 0.2, // Stronger opacity boost from waves

            // RNG Energy bursts - MUCH LESS
            burstChance: 0.00008, // Very rare (was 0.0008)
            burstDuration: 80,
            burstGrowth: 3,       // Smaller burst
            burstOpacity: 0.3,

            // Floating particles
            particleCount: 15,    // Fewer particles
            particleRadius: 0.5,
            particleOpacity: 0.15,
            particleSpeed: 0.2,
            lineDistance: 80,
            lineOpacity: 0.04,
        };

        let gridDots = [];
        let particles = [];
        let width, height;

        // Utility: map function from CodePen
        const map = (value, min1, max1, min2, max2) => {
            const normalized = (value - min1) / (max1 - min1);
            return min2 + (max2 - min2) * normalized;
        };

        // Grid dot class (CodePen-inspired structure)
        class GridDot {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this._radius = params.baseRadius;
                this.radius = params.baseRadius;
                this.growthValue = 0;

                this.phase = Math.random() * Math.PI * 2;
                this.wavePhase = Math.random() * Math.PI * 2;
                this.baseOpacity = params.baseOpacity + Math.random() * 0.02;
                this.opacity = this.baseOpacity;
                this.targetOpacity = this.baseOpacity;

                // Energy burst state
                this.burstTimer = 0;
                this.burstIntensity = 0;
            }

            addRadius(value) {
                this.growthValue = value;
            }

            update(mouseX, mouseY, time) {
                // Wave contribution
                const wave1 = Math.sin(this.x * 0.004 + this.y * 0.003 + time * params.waveSpeed);
                const wave2 = Math.sin(this.x * 0.003 - this.y * 0.002 + time * params.waveSpeed * 1.4 + this.phase);
                const wave3 = Math.sin((this.x + this.y) * 0.002 + time * params.waveSpeed * 0.6 + this.wavePhase);
                const waveValue = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
                const normalizedWave = (waveValue + 1) / 2;

                const waveGrowth = normalizedWave * params.waveGrowth;
                const waveOpacity = normalizedWave * params.waveOpacityBoost;

                // Mouse proximity (CodePen-like calculation)
                const distance = Math.sqrt(Math.pow(this.x - mouseX, 2) + Math.pow(this.y - mouseY, 2));
                let mouseGrowth = map(distance, this._radius, this._radius + params.proximity, params.growth, 0);
                if (mouseGrowth < 0) mouseGrowth = 0;

                const mouseOpacity = mouseGrowth > 0 ? map(distance, 0, params.proximity, 0.7, 0) : 0;

                // RNG Energy burst
                if (this.burstTimer > 0) {
                    this.burstTimer--;
                    this.burstIntensity = (this.burstTimer / params.burstDuration) * params.burstGrowth;
                } else if (Math.random() < params.burstChance) {
                    this.burstTimer = params.burstDuration;
                    this.burstIntensity = params.burstGrowth;
                }

                // Apply growth with easing (CodePen formula)
                const targetRadius = this._radius + waveGrowth + mouseGrowth + this.burstIntensity;
                this.radius += (targetRadius - this.radius) * params.ease;

                this.targetOpacity = this.baseOpacity + waveOpacity +
                    Math.max(0, mouseOpacity) +
                    (this.burstIntensity / params.burstGrowth) * params.burstOpacity;
                this.opacity += (this.targetOpacity - this.opacity) * params.ease;
            }

            draw(ctx) {
                ctx.moveTo(this.x, this.y);
                ctx.arc(this.x, this.y, Math.max(0.3, this.radius), 0, Math.PI * 2);
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
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };

        let time = 0;
        const animate = () => {
            time += 1;

            // Smooth zoom easing
            const zoomState = zoomRef.current;
            const zoomDiff = zoomState.target - zoomState.current;
            zoomState.velocity += zoomDiff * 0.02;
            zoomState.velocity *= 0.85; // Damping
            zoomState.current += zoomState.velocity;

            const zoom = zoomState.current;
            const globalOpacity = zoom >= 1.8 ? Math.max(0, 1 - (zoom - 1.5) * 1.5) : 1;

            ctx.clearRect(0, 0, width, height);

            if (globalOpacity <= 0) {
                animationRef.current = requestAnimationFrame(animate);
                return;
            }

            const mouse = mouseRef.current;

            // Apply smooth zoom transform
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

            // Draw grid dots (batched for performance)
            ctx.beginPath();
            for (const dot of gridDots) {
                dot.update(mouse.x, mouse.y, time);
                dot.draw(ctx);
            }
            // Use average opacity for batch fill (simplified)
            ctx.fillStyle = `rgba(255, 255, 255, 0.35)`;
            ctx.fill();

            // Draw individual opacities for visible dots
            for (const dot of gridDots) {
                if (dot.opacity > 0.1 || dot.radius > 1.5) {
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
            mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
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
                zIndex: 0,
                pointerEvents: 'none',
                background: '#000000',
            }}
        />
    );
}
