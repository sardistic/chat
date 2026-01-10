"use client";

import { useEffect, useRef, useState } from 'react';

/**
 * VantaBackground - Premium 3D animated background using Vanta.js
 * Provides NET effect with connected particles for a modern, high-tech look
 */
export default function VantaBackground({ effect = 'NET' }) {
    const vantaRef = useRef(null);
    const [vantaEffect, setVantaEffect] = useState(null);

    useEffect(() => {
        let mounted = true;

        const loadVanta = async () => {
            // Dynamic import for client-side only
            const THREE = await import('three');

            // Import the specific effect
            let VANTA;
            switch (effect) {
                case 'DOTS':
                    VANTA = (await import('vanta/dist/vanta.dots.min')).default;
                    break;
                case 'NET':
                    VANTA = (await import('vanta/dist/vanta.net.min')).default;
                    break;
                case 'WAVES':
                    VANTA = (await import('vanta/dist/vanta.waves.min')).default;
                    break;
                case 'FOG':
                    VANTA = (await import('vanta/dist/vanta.fog.min')).default;
                    break;
                default:
                    VANTA = (await import('vanta/dist/vanta.net.min')).default;
            }

            if (!mounted || !vantaRef.current) return;

            // Destroy existing effect if any
            if (vantaEffect) vantaEffect.destroy();

            // Configuration based on effect type
            let config = {
                el: vantaRef.current,
                THREE,
                mouseControls: true,
                touchControls: true,
                gyroControls: false,
                minHeight: 200,
                minWidth: 200,
                scale: 1.0,
                scaleMobile: 1.0,
            };

            // Effect-specific options
            switch (effect) {
                case 'NET':
                    config = {
                        ...config,
                        color: 0x3b82f6,           // Blue accent
                        backgroundColor: 0x000000,  // Pure black
                        points: 12,                 // Number of connection points
                        maxDistance: 22,            // Connection distance
                        spacing: 18,                // Grid spacing
                        showDots: true,
                    };
                    break;
                case 'DOTS':
                    config = {
                        ...config,
                        color: 0x6366f1,            // Indigo dots
                        color2: 0x8b5cf6,           // Purple secondary
                        backgroundColor: 0x000000,
                        size: 3,
                        spacing: 35,
                        showLines: true,
                    };
                    break;
                case 'WAVES':
                    config = {
                        ...config,
                        color: 0x000000,
                        waveHeight: 15,
                        waveSpeed: 0.8,
                        shininess: 35,
                        zoom: 0.8,
                    };
                    break;
                case 'FOG':
                    config = {
                        ...config,
                        highlightColor: 0x6366f1,
                        midtoneColor: 0x1e1b4b,
                        lowlightColor: 0x000000,
                        baseColor: 0x000000,
                        blurFactor: 0.6,
                        speed: 1.5,
                        zoom: 1,
                    };
                    break;
            }

            const newEffect = VANTA(config);
            setVantaEffect(newEffect);
        };

        loadVanta();

        return () => {
            mounted = false;
            if (vantaEffect) vantaEffect.destroy();
        };
    }, [effect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (vantaEffect) vantaEffect.destroy();
        };
    }, [vantaEffect]);

    return (
        <div
            ref={vantaRef}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                background: '#000000',
            }}
        />
    );
}
