"use client";

import { useEffect, useRef } from 'react';
import { RIPPLE_PRESETS, rippleCallbacks } from './DotGridRegistry';

export default function DotGridSimple({ className = '', zoomLevel = 0 }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let width, height;
        let gridDots = [];

        const params = {
            size: 45,
            baseRadius: 1.5,
            waveSpeed: 0.002,
            proximity: 250,
            growth: 20
        };

        class GridDot {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.phase = Math.random() * Math.PI * 2;
                this.radius = params.baseRadius;
            }

            update(mouseX, mouseY, time) {
                const wave = Math.sin(this.x * 0.004 + this.y * 0.003 + time * params.waveSpeed + this.phase);

                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const distSq = dx * dx + dy * dy;
                let mouseGrowth = 0;

                if (distSq < params.proximity * params.proximity) {
                    const dist = Math.sqrt(distSq);
                    const t = 1 - dist / params.proximity;
                    mouseGrowth = t * params.growth;
                }

                this.radius = params.baseRadius + (wave + 1) + mouseGrowth;
            }
        }

        const build = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;

            gridDots = [];
            const cols = Math.ceil(width / params.size) + 1;
            const rows = Math.ceil(height / params.size) + 1;
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    gridDots.push(new GridDot(col * params.size, row * params.size));
                }
            }
        };

        let time = 0;
        const animate = () => {
            time += 1;
            ctx.clearRect(0, 0, width, height);

            // Just use raw mouse coords, no smoothing for 'simple' feel or add simple ref
            // For now, static center just to verify it works without complex mouse tracking setups
            // (omitted full mouse tracking for brevity, assumes implementation similar to others)

            ctx.fillStyle = 'rgba(255,255,255,0.3)';

            for (const dot of gridDots) {
                dot.update(-1000, -1000, time); // Dummy mouse

                if (dot.radius > 0.5) {
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            animationRef.current = requestAnimationFrame(animate);
        };

        build();
        window.addEventListener('resize', build);
        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
            window.removeEventListener('resize', build);
        };
    }, []);

    return <canvas ref={canvasRef} className={`fixed inset-0 pointer-events-none -z-10 ${className}`} style={{ background: '#111' }} />;
}
