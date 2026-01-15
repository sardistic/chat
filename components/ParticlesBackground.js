"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

/**
 * ParticlesBackground - tsParticles with grid-like dots
 * Features: wave shadow overlay, zoom light trails, 3D hover, activity attraction
 */
function ParticlesBackgroundComponent({ className = '', zoomLevel = 0 }) {
    const [init, setInit] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

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
        fpsLimit: 30,
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
                    distance: 300,
                    links: {
                        opacity: 0.25,
                        color: "#ffffff"
                    }
                },
                bubble: {
                    distance: 300,
                    size: 12,
                    duration: 0.3,
                    opacity: 1.0,
                },
            },
        },
        particles: {
            color: {
                // 3D depth coloring - subtle chromatic tones
                value: ["#ffffff", "#e8f4ff", "#fff8e8", "#ffe8f4", "#e8ffe8", "#f0e8ff"],
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
                speed: 0.15,
                direction: "none",
                random: true,
                straight: false,
                outModes: {
                    default: "bounce",
                },
                trail: {
                    enable: false,
                },
            },
            number: {
                value: 200, // Reduced for performance
                density: {
                    enable: true,
                    width: 1920,
                    height: 1080,
                },
            },
            opacity: {
                value: {
                    min: 0.3,
                    max: 0.7,
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: 1.5,
                    max: 3.5,
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

    // Wave shadow overlay - re-enabled with visible gradient
    const waveOverlayStyle = useMemo(() => ({
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, transparent 0%, transparent 40%, rgba(100, 100, 255, 0.03) 70%, rgba(150, 100, 255, 0.06) 100%)',
        animation: 'wave-pulse 8s ease-in-out infinite',
        opacity: 0.8,
    }), []);

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
            <>
                <div
                    className={className}
                    style={{
                        ...wrapperStyle,
                        background: 'linear-gradient(135deg, #4f46e5 0%, #0c0c16 50%, #db2777 100%)',
                    }}
                />
                <div style={waveOverlayStyle} />
            </>
        );
    }

    return (
        <>
            <div style={wrapperStyle}>
                <Particles
                    id="tsparticles"
                    className={className}
                    particlesLoaded={particlesLoaded}
                    options={options}
                />
            </div>
            <div style={waveOverlayStyle} />
            {isZooming && <div style={lightTrailsStyle} />}
        </>
    );
}

// Memoize to prevent particle reset on parent re-renders
import { memo } from 'react';
const ParticlesBackground = memo(ParticlesBackgroundComponent);
export default ParticlesBackground;
