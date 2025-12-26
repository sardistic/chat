"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to analyze camera/video brightness and provide effect parameters
 * 
 * @param {HTMLVideoElement} videoRef - Reference to the video element
 * @param {boolean} enabled - Whether effects are enabled
 * @returns {Object} Effect parameters based on lighting analysis
 */
export function useCameraEffects(videoRef, enabled = true) {
    const [brightness, setBrightness] = useState(128); // 0-255
    const [dominantColor, setDominantColor] = useState({ r: 99, g: 102, b: 241 }); // Default indigo
    const [effectIntensity, setEffectIntensity] = useState('normal');
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    // Analyze video frame for brightness and dominant color
    const analyzeFrame = useCallback(() => {
        if (!videoRef?.current || !enabled) return;

        const video = videoRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        // Create canvas if needed
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = 32; // Low res for performance
            canvasRef.current.height = 32;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        try {
            // Draw video frame to canvas (scaled down)
            ctx.drawImage(video, 0, 0, 32, 32);
            const imageData = ctx.getImageData(0, 0, 32, 32);
            const data = imageData.data;

            let totalBrightness = 0;
            let totalR = 0, totalG = 0, totalB = 0;
            const pixelCount = 32 * 32;

            // Analyze pixels
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Perceived brightness (human eye is more sensitive to green)
                const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
                totalBrightness += brightness;

                totalR += r;
                totalG += g;
                totalB += b;
            }

            const avgBrightness = totalBrightness / pixelCount;
            const avgR = Math.round(totalR / pixelCount);
            const avgG = Math.round(totalG / pixelCount);
            const avgB = Math.round(totalB / pixelCount);

            setBrightness(avgBrightness);
            setDominantColor({ r: avgR, g: avgG, b: avgB });

            // Determine effect intensity based on brightness
            if (avgBrightness < 50) {
                setEffectIntensity('dark');
            } else if (avgBrightness < 100) {
                setEffectIntensity('dim');
            } else if (avgBrightness < 150) {
                setEffectIntensity('normal');
            } else if (avgBrightness < 200) {
                setEffectIntensity('bright');
            } else {
                setEffectIntensity('intense');
            }
        } catch (e) {
            // Ignore canvas security errors (can happen with cross-origin streams)
        }
    }, [videoRef, enabled]);

    // Run analysis loop
    useEffect(() => {
        if (!enabled) return;

        let frameCount = 0;
        const analyze = () => {
            frameCount++;
            // Analyze every 6th frame (~10fps at 60fps)
            if (frameCount % 6 === 0) {
                analyzeFrame();
            }
            animationRef.current = requestAnimationFrame(analyze);
        };

        animationRef.current = requestAnimationFrame(analyze);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [analyzeFrame, enabled]);

    // Calculate effect properties
    const getEffectStyles = useCallback(() => {
        const { r, g, b } = dominantColor;

        // Boost saturation for more vibrant effects
        const boostFactor = 1.5;
        const boostedR = Math.min(255, Math.round(r * boostFactor));
        const boostedG = Math.min(255, Math.round(g * boostFactor));
        const boostedB = Math.min(255, Math.round(b * boostFactor));

        const baseColor = `rgb(${boostedR}, ${boostedG}, ${boostedB})`;
        const glowColor = `rgba(${boostedR}, ${boostedG}, ${boostedB}, 0.8)`;

        // Different effects based on intensity
        switch (effectIntensity) {
            case 'dark':
                return {
                    borderColor: `rgba(100, 150, 255, 0.5)`,
                    glowColor: `rgba(100, 150, 255, 0.4)`,
                    glowSize: 20,
                    sparkleCount: 6,
                    sparkleSpeed: 'slow',
                    pulseAnimation: false,
                };
            case 'dim':
                return {
                    borderColor: `rgba(${boostedR}, ${boostedG}, ${boostedB}, 0.6)`,
                    glowColor: `rgba(${boostedR}, ${boostedG}, ${boostedB}, 0.5)`,
                    glowSize: 28,
                    sparkleCount: 8,
                    sparkleSpeed: 'normal',
                    pulseAnimation: false,
                };
            case 'normal':
                return {
                    borderColor: baseColor,
                    glowColor: glowColor,
                    glowSize: 36,
                    sparkleCount: 12,
                    sparkleSpeed: 'normal',
                    pulseAnimation: true,
                };
            case 'bright':
                return {
                    borderColor: baseColor,
                    glowColor: glowColor,
                    glowSize: 48,
                    sparkleCount: 18,
                    sparkleSpeed: 'fast',
                    pulseAnimation: true,
                };
            case 'intense':
                return {
                    borderColor: '#FFD700', // Gold
                    glowColor: 'rgba(255, 215, 0, 0.7)',
                    glowSize: 60,
                    sparkleCount: 25,
                    sparkleSpeed: 'fast',
                    pulseAnimation: true,
                    rainbow: true,
                };
            default:
                return {
                    borderColor: baseColor,
                    glowColor: glowColor,
                    glowSize: 16,
                    sparkleCount: 6,
                    sparkleSpeed: 'normal',
                    pulseAnimation: false,
                };
        }
    }, [dominantColor, effectIntensity]);

    return {
        brightness,
        dominantColor,
        effectIntensity,
        effectStyles: getEffectStyles(),
    };
}

/**
 * Sparkle overlay component for video tiles
 */
export function SparkleOverlay({ count = 6, speed = 'normal', active = true }) {
    const [sparkles, setSparkles] = useState([]);

    useEffect(() => {
        if (!active) {
            setSparkles([]);
            return;
        }

        // Generate sparkles
        const newSparkles = Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 8 + 8, // 8-16px (was 4-10px)
            delay: Math.random() * 2,
            duration: speed === 'fast' ? 1 : speed === 'slow' ? 3 : 2,
        }));
        setSparkles(newSparkles);
    }, [count, speed, active]);

    if (!active || sparkles.length === 0) return null;

    return (
        <div className="sparkle-overlay">
            {sparkles.map((sparkle) => (
                <div
                    key={sparkle.id}
                    className="sparkle"
                    style={{
                        left: `${sparkle.x}%`,
                        top: `${sparkle.y}%`,
                        width: `${sparkle.size}px`,
                        height: `${sparkle.size}px`,
                        animationDelay: `${sparkle.delay}s`,
                        animationDuration: `${sparkle.duration}s`,
                    }}
                />
            ))}
        </div>
    );
}
