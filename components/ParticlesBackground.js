"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

/**
 * ParticlesBackground - tsParticles with grid-like dots
 * Dense grid, subtle 3D lines, zoom transition support
 */
export default function ParticlesBackground({ className = '', zoomLevel = 0 }) {
    const [init, setInit] = useState(false);

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
            zIndex: 0
        },
        background: {
            color: {
                value: "#000000",
            },
        },
        fpsLimit: 60,
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
                    distance: 180,
                    links: {
                        opacity: 0.12,
                        color: "#ffffff"
                    }
                },
                bubble: {
                    distance: 160,
                    size: 3.5,
                    duration: 0.3,
                    opacity: 0.5,
                },
            },
        },
        particles: {
            color: {
                value: "#ffffff",
            },
            links: {
                enable: true,
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
            },
            number: {
                value: 500,
                density: {
                    enable: true,
                    width: 1920,
                    height: 1080,
                },
            },
            opacity: {
                value: {
                    min: 0.06,
                    max: 0.18,
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: 0.6,
                    max: 1.6,
                },
            },
        },
        detectRetina: true,
    }), []);

    const particlesLoaded = useCallback(async (container) => {
        // Particles loaded
    }, []);

    // Zoom transition styles
    const zoomOpacity = zoomLevel >= 1.8 ? Math.max(0, 1 - (zoomLevel - 1.5) * 1.5) : 1;
    const zoomScale = zoomLevel > 0.01 ? 1 + zoomLevel * 0.15 : 1;

    const wrapperStyle = useMemo(() => ({
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: zoomOpacity,
        transform: `scale(${zoomScale})`,
        transition: 'transform 0.4s ease-out, opacity 0.4s ease-out',
        transformOrigin: 'center center',
    }), [zoomOpacity, zoomScale]);

    if (!init) {
        return (
            <div
                className={className}
                style={{
                    ...wrapperStyle,
                    background: '#000000',
                }}
            />
        );
    }

    return (
        <div style={wrapperStyle}>
            <Particles
                id="tsparticles"
                className={className}
                particlesLoaded={particlesLoaded}
                options={options}
            />
        </div>
    );
}
