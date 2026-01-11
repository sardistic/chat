"use client";

import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

/**
 * ParticlesBackground - tsParticles-based dot grid
 * Replicates the sparse dot grid revealed by mouse/waves
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
        fullScreen: false,
        background: {
            color: {
                value: "#000000",
            },
        },
        fpsLimit: 60,
        interactivity: {
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
                    distance: 200,
                    links: {
                        opacity: 0.15,
                        color: "#ffffff"
                    }
                },
                bubble: {
                    distance: 250,
                    size: 6,
                    duration: 0.3,
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
                speed: 0.15,
                direction: "none",
                random: true,
                straight: false,
                outModes: {
                    default: "bounce",
                },
            },
            number: {
                value: 120,
                density: {
                    enable: true,
                    width: 800,
                    height: 800,
                },
            },
            opacity: {
                value: {
                    min: 0.02,
                    max: 0.15,
                },
                animation: {
                    enable: true,
                    speed: 0.8,
                    sync: false,
                    startValue: "random",
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: 0.3,
                    max: 1.2,
                },
            },
        },
        detectRetina: true,
    }), []);

    const containerStyle = useMemo(() => ({
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: zoomLevel >= 1.8 ? Math.max(0, 1 - (zoomLevel - 1.5) * 1.5) : 1,
        transform: zoomLevel > 0.01 ? `scale(${1 + zoomLevel * 0.2})` : 'none',
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
    }), [zoomLevel]);

    if (!init) {
        return (
            <div
                className={className}
                style={{
                    ...containerStyle,
                    background: '#000000',
                }}
            />
        );
    }

    return (
        <Particles
            id="tsparticles"
            className={className}
            style={containerStyle}
            options={options}
        />
    );
}
