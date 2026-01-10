"use client";

import { useEffect, useRef } from 'react';

/**
 * DotGrid - Animated dot grid background with wave effects and mouse interaction
 * Uses Canvas for performant individual dot animation
 */
export default function DotGrid({ className = '' }) {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animationRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width, height;
        let dots = [];
        const GRID_SIZE = 32;
        const DOT_RADIUS = 1;
        const MOUSE_RADIUS = 200;
        const WAVE_SPEED = 0.002;
        const WAVE_AMPLITUDE = 0.4;

        // Resize handler
        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;

            // Recreate dots grid
            dots = [];
            for (let x = 0; x < width + GRID_SIZE; x += GRID_SIZE) {
                for (let y = 0; y < height + GRID_SIZE; y += GRID_SIZE) {
                    dots.push({
                        x,
                        y,
                        baseOpacity: 0.03 + Math.random() * 0.02, // Slight random variance
                        phase: Math.random() * Math.PI * 2, // Random phase for wave
                    });
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

            for (const dot of dots) {
                // Wave effect - multiple overlapping waves for organic feel
                const wave1 = Math.sin(dot.x * 0.01 + dot.y * 0.005 + time * WAVE_SPEED) * WAVE_AMPLITUDE;
                const wave2 = Math.sin(dot.x * 0.008 - dot.y * 0.003 + time * WAVE_SPEED * 1.3 + dot.phase) * WAVE_AMPLITUDE * 0.5;
                const wave3 = Math.sin((dot.x + dot.y) * 0.004 + time * WAVE_SPEED * 0.7) * WAVE_AMPLITUDE * 0.3;
                const waveValue = (wave1 + wave2 + wave3) / 2 + 0.5; // Normalize to 0-1

                // Mouse proximity effect
                const dx = mouse.x - dot.x;
                const dy = mouse.y - dot.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const mouseInfluence = Math.max(0, 1 - dist / MOUSE_RADIUS);
                const mouseGlow = mouseInfluence * mouseInfluence; // Quadratic falloff for smoother gradient

                // Final opacity: base + wave + mouse
                const waveOpacity = dot.baseOpacity + waveValue * 0.15;
                const finalOpacity = Math.min(1, waveOpacity + mouseGlow * 0.8);

                // Draw dot
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
                ctx.fill();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        // Initialize
        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);
        animate();

        // Cleanup
        return () => {
            window.removeEventListener('resize', resize);
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
