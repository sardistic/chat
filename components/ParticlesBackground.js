"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

/**
 * ParticlesBackground - tsParticles with grid-like sparse dots
 * Fullscreen, no connecting lines, mouse hover reveals dots
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
                    mode: "bubble",
                    parallax: {
                        enable: false,
                    }
                },
                resize: {
                    enable: true,
                },
            },
            modes: {
                bubble: {
                    distance: 200,
                    size: 5,
                    duration: 0.4,
                    opacity: 0.8,
                },
            },
        },
        particles: {
            color: {
                value: "#ffffff",
            },
            links: {
                enable: false,
            },
            move: {
                enable: true,
                speed: 0.08,
                direction: "none",
                random: false,
                straight: false,
                outModes: {
                    default: "out",
                },
                vibrate: true,
            },
            number: {
                value: 200,
                density: {
                    enable: true,
                    width: 1920,
                    height: 1080,
                },
            },
            opacity: {
                value: {
                    min: 0.01,
                    max: 0.08,
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: 0.5,
                    max: 1.5,
                },
            },
        },
        detectRetina: true,
    }), []);

    const particlesLoaded = useCallback(async (container) => {
        // Particles loaded
    }, []);

    if (!init) {
        return (
            <div
                className={className}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 0,
                    background: '#000000',
                    pointerEvents: 'none',
                }}
            />
        );
    }

    return (
        <Particles
            id="tsparticles"
            className={className}
            particlesLoaded={particlesLoaded}
            options={options}
        />
    );
}
