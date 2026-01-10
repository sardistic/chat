"use client";

import { useEffect, useRef } from 'react';

/**
 * DotGrid - Animated dot grid with proximity growth + wave effects + floating particles
 * Combines grid-based dots with sparse floating particles (particles.js inspired)
 */
export default function DotGrid({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animationRef = useRef(null);
    const zoomRef = useRef(zoomLevel);

    useEffect(() => {
        zoomRef.current = zoomLevel;
    }, [zoomLevel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Parameters - darkened and smaller
        const params = {
            // Grid dots
            size: 32,
            baseRadius: 0.6,      // Smaller dots
            baseOpacity: 0.06,    // Much darker
            proximity: 200,
            growth: 4,            // Less growth
            ease: 0.06,
            waveSpeed: 0.0015,
            waveGrowth: 1.2,

            // Floating particles (particles.js inspired)
            particleCount: 35,    // Sparse
            particleRadius: 0.8,
            particleOpacity: 0.25,
            particleSpeed: 0.3,
            lineDistance: 120,    // Connect particles within this range to mouse
            lineOpacity: 0.08,    // Very subtle lines
        };

        let gridDots = [];
        let particles = [];
        let width, height;

        // Grid dot class
        class GridDot {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.baseRadius = params.baseRadius;
                this.radius = params.baseRadius;
                this.targetRadius = params.baseRadius;
                this.phase = Math.random() * Math.PI * 2;
                this.wavePhase = Math.random() * Math.PI * 2;
                this.baseOpacity = params.baseOpacity + Math.random() * 0.03;
                this.opacity = this.baseOpacity;
                this.targetOpacity = this.baseOpacity;
            }

            update(mouseX, mouseY, time, ease) {
                // Wave contribution
                const wave1 = Math.sin(this.x * 0.005 + this.y * 0.003 + time * params.waveSpeed);
                const wave2 = Math.sin(this.x * 0.004 - this.y * 0.002 + time * params.waveSpeed * 1.5 + this.phase);
                const wave3 = Math.sin((this.x + this.y) * 0.002 + time * params.waveSpeed * 0.7 + this.wavePhase);
                const waveValue = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
                const normalizedWave = (waveValue + 1) / 2;

                const waveGrowth = normalizedWave * params.waveGrowth;

                // Mouse proximity
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                let mouseGrowth = 0;
                let mouseOpacity = 0;
                if (distance < params.proximity) {
                    const factor = 1 - (distance / params.proximity);
                    mouseGrowth = factor * factor * params.growth;
                    mouseOpacity = factor * factor * 0.5;
                }

                this.targetRadius = this.baseRadius + waveGrowth + mouseGrowth;
                this.targetOpacity = this.baseOpacity + (normalizedWave * 0.08) + mouseOpacity;

                this.radius += (this.targetRadius - this.radius) * ease;
                this.opacity += (this.targetOpacity - this.opacity) * ease;
            }

            draw(ctx) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, Math.max(0.3, this.radius), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, this.opacity)})`;
                ctx.fill();
            }
        }

        // Floating particle class (particles.js inspired)
        class Particle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * params.particleSpeed;
                this.vy = (Math.random() - 0.5) * params.particleSpeed;
                this.radius = params.particleRadius + Math.random() * 0.5;
                this.opacity = params.particleOpacity + Math.random() * 0.1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Wrap around edges
                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;
            }

            draw(ctx, mouseX, mouseY) {
                // Draw particle
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
                ctx.fill();

                // Draw line to mouse if close enough
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

        // Build grid and particles
        const build = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;

            // Grid dots
            gridDots = [];
            const columns = Math.ceil(width / params.size) + 1;
            const rows = Math.ceil(height / params.size) + 1;
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < columns; col++) {
                    gridDots.push(new GridDot(col * params.size, row * params.size));
                }
            }

            // Floating particles
            particles = [];
            for (let i = 0; i < params.particleCount; i++) {
                particles.push(new Particle());
            }
        };

        // Mouse handler
        const handleMouseMove = (e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };

        // Animation loop
        let time = 0;
        const animate = () => {
            time += 1;
            ctx.clearRect(0, 0, width, height);

            const mouse = mouseRef.current;
            const zoom = zoomRef.current;

            // Zoom fade out
            const globalOpacity = zoom >= 2 ? Math.max(0, 1 - (zoom - 1.5) * 2) : 1;

            if (globalOpacity <= 0) {
                animationRef.current = requestAnimationFrame(animate);
                return;
            }

            // Apply zoom transform
            if (zoom > 0) {
                const scale = 1 + zoom * 0.15;
                const centerX = width / 2;
                const centerY = height / 2;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.scale(scale, scale);
                ctx.translate(-centerX, -centerY);
                ctx.globalAlpha = globalOpacity;
            }

            // Draw grid dots
            for (const dot of gridDots) {
                dot.update(mouse.x, mouse.y, time, params.ease);
                dot.draw(ctx);
            }

            // Draw floating particles
            for (const particle of particles) {
                particle.update();
                particle.draw(ctx, mouse.x, mouse.y);
            }

            if (zoom > 0) {
                ctx.restore();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        // Initialize
        build();
        window.addEventListener('resize', build);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', (e) => {
            mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        });
        animate();

        // Cleanup
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
