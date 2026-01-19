"use client";

import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

/**
 * StarMapBackground - tsParticles with random star placement
 * Classic particles that float and react to mouse hover
 */
function StarMapBackgroundComponent({ className = '', zoomLevel = 0 }) {
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
                        opacity: 0.15,
                        color: "#ffffff"
                    }
                },
                bubble: {
                    distance: 250,
                    size: 12,
                    duration: 0.3,
                    opacity: 0.9,
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
                speed: 0.2,
                direction: "none",
                random: true,
                straight: false,
                outModes: {
                    default: "bounce",
                },
            },
            number: {
                value: 400,
                density: {
                    enable: true,
                    width: 1920,
                    height: 1080,
                },
            },
            opacity: {
                value: {
                    min: 0.3,
                    max: 0.8,
                },
            },
            shape: {
                type: "circle",
            },
            size: {
                value: {
                    min: 0.2,
                    max: 1.2,
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

    const wrapperStyle = useMemo(() => ({
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: zoomOpacity,
        transform: `scale(${zoomScale})`,
        filter: motionBlur,
        transition: isZooming
            ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease-out'
            : 'transform 0.4s ease-out, opacity 0.4s ease-out',
        transformOrigin: 'center center',
    }), [zoomOpacity, zoomScale, motionBlur, isZooming]);

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

const StarMapBackground = memo(StarMapBackgroundComponent);
export default StarMapBackground;
