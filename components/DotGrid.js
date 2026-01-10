"use client";

import { useEffect, useRef } from 'react';

/**
 * DotGrid - Animated dot grid with proximity growth + wave effects
 * Inspired by: proximity-based growth with smooth easing
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

        // Parameters (inspired by CodePen reference)
        const params = {
            size: 32,          // Grid spacing
            baseRadius: 1,     // Base dot size
            proximity: 180,    // Mouse effect radius
            growth: 8,         // Max growth when mouse is close
            ease: 0.08,        // Easing factor for smooth animation
            waveSpeed: 0.002,  // Wave animation speed
            waveGrowth: 2,     // Max growth from waves
        };

        let circles = [];
        let width, height;

        // Circle class with growth easing
        class Circle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.baseRadius = params.baseRadius;
                this.radius = params.baseRadius;
                this.targetRadius = params.baseRadius;
                this.phase = Math.random() * Math.PI * 2;
                this.wavePhase = Math.random() * Math.PI * 2;
                this.baseOpacity = 0.15 + Math.random() * 0.1;
                this.opacity = this.baseOpacity;
                this.targetOpacity = this.baseOpacity;
            }

            update(mouseX, mouseY, time, ease) {
                // Calculate wave contribution (multiple overlapping waves)
                const wave1 = Math.sin(this.x * 0.005 + this.y * 0.003 + time * params.waveSpeed);
                const wave2 = Math.sin(this.x * 0.004 - this.y * 0.002 + time * params.waveSpeed * 1.5 + this.phase);
                const wave3 = Math.sin((this.x + this.y) * 0.002 + time * params.waveSpeed * 0.7 + this.wavePhase);
                const waveValue = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
                const normalizedWave = (waveValue + 1) / 2; // 0-1

                // Wave-based growth (gusts)
                const waveGrowth = normalizedWave * params.waveGrowth;

                // Mouse proximity calculation
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Map distance to growth (closer = more growth)
                let mouseGrowth = 0;
                let mouseOpacity = 0;
                if (distance < params.proximity) {
                    const factor = 1 - (distance / params.proximity);
                    mouseGrowth = factor * factor * params.growth; // Quadratic falloff
                    mouseOpacity = factor * factor * 0.7;
                }

                // Set targets
                this.targetRadius = this.baseRadius + waveGrowth + mouseGrowth;
                this.targetOpacity = this.baseOpacity + (normalizedWave * 0.15) + mouseOpacity;

                // Apply easing (smooth animation)
                this.radius += (this.targetRadius - this.radius) * ease;
                this.opacity += (this.targetOpacity - this.opacity) * ease;
            }

            draw(ctx) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, Math.max(0.5, this.radius), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, this.opacity)})`;
                ctx.fill();
            }
        }

        // Build grid
        const build = () => {
            circles = [];
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;

            const columns = Math.ceil(width / params.size) + 1;
            const rows = Math.ceil(height / params.size) + 1;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < columns; col++) {
                    circles.push(new Circle(col * params.size, row * params.size));
                }
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

            // Update and draw all circles
            for (const circle of circles) {
                circle.update(mouse.x, mouse.y, time, params.ease);
                circle.draw(ctx);
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
