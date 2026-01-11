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
                    distance: 150,
                    links: {
                        opacity: 0.08,
                        color: "#ffffff"
                    }
                },
                bubble: {
                    distance: 180,
                    size: 4,
                    duration: 0.3,
                    opacity: 0.6,
                },
            },
        },
        particles: {
            color: {
                value: "#ffffff",
            },
            links: {
                enable: true,
                distance: 120,
                color: "#ffffff",
                opacity: 0.03,
                width: 0.5,
            },
            move: {
                enable: false,
            },
            number: {
                value: 350,
                density: {
                    enable: true,
                    width: 1920,
                    height: 1080,
                },
            },
            opacity: {
                value: {
                    min: 0.05,
                    max: 0.2,
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: 0.8,
                    max: 1.8,
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
