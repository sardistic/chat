"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Animated dot matrix grid that reacts to camera video colors
 * Renders a grid of dots behind video tiles that shift color based on the camera feed
 */
export default function CameraReactiveGrid({ videoRef, isActive = false }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const [dominantColor, setDominantColor] = useState({ r: 99, g: 102, b: 241 });

    // Config
    const DOT_SIZE = 4;
    const DOT_SPACING = 24;
    const WAVE_SPEED = 0.002;
    const WAVE_AMPLITUDE = 2;

    // Analyze video for dominant color
    const analyzeVideo = useCallback(() => {
        if (!videoRef?.current || !isActive) return;

        const video = videoRef.current;
        if (video.videoWidth === 0) return;

        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCanvas.width = 16;
        tempCanvas.height = 16;

        try {
            ctx.drawImage(video, 0, 0, 16, 16);
            const data = ctx.getImageData(0, 0, 16, 16).data;

            let r = 0, g = 0, b = 0;
            const count = 16 * 16;

            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
            }

            // Boost saturation
            const boost = 1.5;
            setDominantColor({
                r: Math.min(255, Math.round(r / count * boost)),
                g: Math.min(255, Math.round(g / count * boost)),
                b: Math.min(255, Math.round(b / count * boost)),
            });
        } catch (e) {
            // Ignore canvas security errors
        }
    }, [videoRef, isActive]);

    // Render animated grid
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let time = 0;
        let frameCount = 0;

        const render = () => {
            // Analyze video every 10 frames
            frameCount++;
            if (frameCount % 10 === 0) {
                analyzeVideo();
            }

            // Update canvas size
            const rect = canvas.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw dots
            const { r, g, b } = dominantColor;
            const cols = Math.ceil(canvas.width / DOT_SPACING) + 1;
            const rows = Math.ceil(canvas.height / DOT_SPACING) + 1;

            time += WAVE_SPEED;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    // Base position
                    let x = col * DOT_SPACING;
                    let y = row * DOT_SPACING;

                    // Wave animation
                    const wave = Math.sin(time * 2 + (col + row) * 0.3) * WAVE_AMPLITUDE;
                    x += wave;
                    y += Math.cos(time * 2 + (col - row) * 0.3) * WAVE_AMPLITUDE;

                    // Distance-based opacity (brighter in center/corners)
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
                    const normalizedDist = dist / maxDist;

                    // Pulse opacity
                    const pulse = 0.3 + Math.sin(time + row * 0.2) * 0.15;
                    const opacity = isActive
                        ? pulse * (1 - normalizedDist * 0.5)
                        : 0.15 * (1 - normalizedDist * 0.5);

                    // Color (blend with camera color when active)
                    const dotR = isActive ? r : 99;
                    const dotG = isActive ? g : 102;
                    const dotB = isActive ? b : 241;

                    ctx.beginPath();
                    ctx.arc(x, y, DOT_SIZE / 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${dotR}, ${dotG}, ${dotB}, ${opacity})`;
                    ctx.fill();
                }
            }

            animationRef.current = requestAnimationFrame(render);
        };

        animationRef.current = requestAnimationFrame(render);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [analyzeVideo, dominantColor, isActive]);

    return (
        <canvas
            ref={canvasRef}
            className="camera-reactive-grid"
            style={{
                position: 'absolute',
                inset: '-20px',
                width: 'calc(100% + 40px)',
                height: 'calc(100% + 40px)',
                pointerEvents: 'none',
                zIndex: -1,
                opacity: 0.8,
            }}
        />
    );
}
