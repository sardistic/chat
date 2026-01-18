"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Global registry for tile positions
const tilePositions = new Map();
export function registerTilePosition(username, x, y) {
    tilePositions.set(username, { x, y });
}
export function unregisterTilePosition(username) {
    tilePositions.delete(username);
}
export function getTilePosition(username) {
    return tilePositions.get(username) || null;
}

// Global ripple event bus
const rippleCallbacks = new Set();
export function triggerDotRipple(type = 'message', origin = null, color = '#ffffff', intensity = 1.0) {
    rippleCallbacks.forEach(cb => cb(type, origin, color, intensity));
}

// Ripple Presets
const RIPPLE_PRESETS = {
    keystroke: { speed: 40, width: 200, growth: 1, opacity: 0.15 },
    typing: { speed: 35, width: 300, growth: 1.5, opacity: 0.2 },
    message: { speed: 25, width: 450, growth: 3, opacity: 0.4 },
    system: { speed: 30, width: 350, growth: 2, opacity: 0.3 },
};

/**
 * DotGrid - Three.js WebGL GPU Implementation
 * High performance 5-layer ferrofluid simulation
 */
export default function DotGrid({ className = '', zoomLevel = 0 }) {
    const containerRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });

    // Shader Uniforms References
    const uniformsRef = useRef({
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(-1000, -1000) },
        uScreenSize: { value: new THREE.Vector2(1, 1) },
        uZoom: { value: 0 },
        uDragFactor: { value: 1.0 }, // Default, overridden per layer
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        // Ripples (Max 20 active)
        uRipples: { value: new Array(20).fill(new THREE.Vector3(0, 0, -1)) }, // (x, y, currentRadius)  Z=-1 is dead
        uRippleParams: { value: new Array(20).fill(new THREE.Vector3(0, 0, 0)) }, // (width, opacity, unused)
        // Note: activeRipples manages the logic
    });

    const activeRipples = useRef([]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // --- SCENE SETUP ---
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000); // 0..1 coordinate system for ease
        camera.position.z = 10;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // --- GEOMETRY ---
        // Create grid points
        const gridSize = 45; // Pixel spacing
        const cols = Math.ceil(window.innerWidth / gridSize) + 2;
        const rows = Math.ceil(window.innerHeight / gridSize) + 2;
        const count = cols * rows;

        const positions = new Float32Array(count * 3);
        const randoms = new Float32Array(count); // Phase variations

        let i = 0;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                positions[i * 3] = x * gridSize;
                positions[i * 3 + 1] = y * gridSize;
                positions[i * 3 + 2] = 0;

                randoms[i] = Math.random();
                i++;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

        // --- SHADER ---
        const vertexShader = `
            uniform float uTime;
            uniform vec2 uMouse;
            uniform vec2 uScreenSize;
            uniform float uZoom;
            uniform float uDragFactor; 
            uniform float uPixelRatio; // Added for correct sizing on Retina
            
            // Ripples
            uniform vec3 uRipples[20]; 
            uniform vec3 uRippleParams[20]; 
            
            attribute float aRandom;
            
            varying float vOpacity;
            varying vec3 vColor;
            varying float vSize;
            
            void main() {
                vec3 pos = position;
                
                // 1. Mouse Magnetic Pull
                float mouseDist = distance(pos.xy, uMouse);
                float hoverRadius = 350.0;
                
                float hoverT = 1.0 - clamp(mouseDist / hoverRadius, 0.0, 1.0);
                float falloff = hoverT * hoverT;
                
                if (mouseDist < hoverRadius) {
                    vec2 dir = normalize(pos.xy - uMouse);
                    // Negative direction = pull TOWARDS mouse
                    // Increase strength slightly
                    float strength = -35.0 * uDragFactor * falloff; 
                    pos.xy += dir * strength;
                }
                
                // 2. Wave Animation
                float wave = sin(pos.x * 0.003 + pos.y * 0.002 + uTime * 1.5 + aRandom * 6.28);
                float waveNorm = (wave + 1.0) * 0.5;
                
                // 3. Ripple Influence
                float totalRippleInf = 0.0;
                
                for(int i = 0; i < 20; i++) {
                    if (uRipples[i].z < 0.0) continue; 
                    
                    vec2 ripPos = uRipples[i].xy;
                    float radius = uRipples[i].z;
                    float width = uRippleParams[i].x;
                    
                    // Use transformed position or original? 
                    // Original is better for wave stability, but transformed interacts nicely.
                    // Let's use current dragged position for interaction
                    float d = distance(pos.xy, ripPos);
                    float distFromRing = abs(d - radius);
                    
                    if (distFromRing < width) {
                        float t = 1.0 - (distFromRing / width);
                        totalRippleInf += t * t; 
                    }
                }
                totalRippleInf = clamp(totalRippleInf, 0.0, 1.0);

                // --- SIZING ---
                float baseSize = 4.0; // Slightly larger base
                float growSize = baseSize * 5.0 * falloff; 
                float waveSize = baseSize * 0.5 * waveNorm; 
                float ripSize = baseSize * 15.0 * totalRippleInf; 
                
                vSize = baseSize + growSize + waveSize + ripSize;
                
                // Layer specific size adjustment
                if (uDragFactor > 0.3) {
                     vSize *= (0.8 + 0.5 * uDragFactor); 
                } else {
                     vSize *= 0.6; 
                }
                
                // Apply Pixel Ratio Scaling
                gl_PointSize = vSize * (1.0 + uZoom * 0.2) * uPixelRatio;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                
                // --- COLOR / OPACITY ---
                float baseOp = 0.15; // Slightly reduced base opacity
                float opacity = baseOp + (falloff * 0.6) + (waveNorm * 0.15) + (totalRippleInf * 0.6);
                
                opacity *= (1.2 - uDragFactor * 0.8); 
                
                vOpacity = clamp(opacity, 0.0, 1.0);
                vColor = vec3(1.0); 
            }
        `;

        const fragmentShader = `
            varying float vOpacity;
            varying vec3 vColor;
            varying float vSize;
            uniform float uDragFactor;

            void main() {
                // Draw circle in PointStore
                vec2 coord = gl_PointCoord - vec2(0.5);
                float dist = length(coord);
                
                // Discard corners
                if (dist > 0.5) discard;
                
                // Antialias edge
                float delta = 0.05;
                float alpha = 1.0 - smoothstep(0.45 - delta, 0.45, dist);
                
                // Hollow Rings for Outer Layers
                if (uDragFactor > 0.3) {
                     // Create ring effect using distance field
                     // Inner hole
                     float innerStroke = 1.0 - smoothstep(0.35, 0.35 + delta, dist);
                     // Result = Circle - InnerHole
                     alpha -= innerStroke;
                     alpha = max(0.0, alpha);
                }
                
                gl_FragColor = vec4(vColor, vOpacity * alpha);
            }
        `;

        // Create 5 Layers (Points Systems)
        const layersData = [
            { drag: 1.0, z: 0 },   // Outer
            { drag: 0.8, z: 1 },
            { drag: 0.6, z: 2 },
            { drag: 0.4, z: 3 },
            { drag: 0.2, z: 4 }    // Core
        ];

        const layersMeshes = [];

        layersData.forEach(layer => {
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    ...uniformsRef.current,
                    uDragFactor: { value: layer.drag }
                },
                vertexShader,
                fragmentShader,
                transparent: true,
                depthWrite: false, // Important for overlapping blending
                blending: THREE.AdditiveBlending
            });

            const mesh = new THREE.Points(geometry, material);
            // We don't really use Z depth for occlusion since it's additive/transparent
            // But we can sort them if needed. Additive doesn't require sorting.
            scene.add(mesh);
            layersMeshes.push(mesh);
        });

        // --- RESIZE ---
        camera.left = 0;
        camera.right = window.innerWidth;
        camera.top = 0;
        camera.bottom = window.innerHeight;
        camera.updateProjectionMatrix();

        const handleResize = () => {
            // Rebuild geometry if needed? Or just expand camera
            // For simplicity, just update camera and renderer
            camera.right = window.innerWidth;
            camera.bottom = window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            uniformsRef.current.uScreenSize.value.set(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // --- ANIMATION LOOP ---
        let time = 0;
        let reqId;
        const animate = () => {
            reqId = requestAnimationFrame(animate);
            time += 0.01;

            // Update Uniforms
            uniformsRef.current.uTime.value = time;

            // Mouse Lerp (JS side)
            // (Vertex shader uses passed uniform directly)
            // But we update the uniformRef value
            const targetX = mouseRef.current.targetX || -1000;
            const targetY = mouseRef.current.targetY || -1000;

            const curX = uniformsRef.current.uMouse.value.x;
            const curY = uniformsRef.current.uMouse.value.y;

            // Lerp
            uniformsRef.current.uMouse.value.x += (targetX - curX) * 0.15;
            uniformsRef.current.uMouse.value.y += (targetY - curY) * 0.15; // Inverted Y? No, pixel space is 0-Height.
            // Note: Threejs Ortho camera usually 0,0 center? 
            // We set it 0..Width, 0..Height if we configured right.
            // Let's check Setup: left=0, right=Width, top=0, bottom=Height.
            // Wait, Standard Threejs Top is +Y? Canvas is +Y down.
            // OrthoCamera( left, right, top, bottom )
            // If top=0, bottom=Height -> Y increases DOWN. Matches Canvas coords! 


            // Ripple Logic
            const ripples = activeRipples.current;
            const uRipples = uniformsRef.current.uRipples.value;
            const uRippleParams = uniformsRef.current.uRippleParams.value;

            // Reset uniforms to dead
            for (let i = 0; i < 20; i++) uRipples[i].z = -1;

            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;

                // Map to uniform array index
                if (i < 20) {
                    uRipples[i].set(r.x, r.y, r.radius);
                    uRippleParams[i].set(r.width, 1.0, 0); // Opacity not fully used in basic vers
                }

                if (r.radius > window.innerWidth * 1.5) {
                    ripples.splice(i, 1);
                }
            }

            renderer.render(scene, camera);
        };
        animate();

        // --- INPUTS ---
        const handleMouseMove = (e) => {
            mouseRef.current.targetX = e.clientX;
            // WebGL Y is usually flipped? 
            // We set Camera top=0, bottom=Height. It should match.
            mouseRef.current.targetY = e.clientY;
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Ripple Listener
        const rippleHandler = (type, origin, color, intensity) => {
            const preset = RIPPLE_PRESETS[type] || RIPPLE_PRESETS.message;
            // Use origin or default
            const rx = origin?.x ?? window.innerWidth;
            const ry = origin?.y ?? window.innerHeight * 0.8;

            activeRipples.current.push({
                x: rx,
                y: ry,
                radius: 0,
                speed: preset.speed,
                width: preset.width
            });
        };
        rippleCallbacks.add(rippleHandler);

        return () => {
            cancelAnimationFrame(reqId);
            renderer.dispose();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            rippleCallbacks.delete(rippleHandler);
            if (container) container.innerHTML = '';
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`fixed inset-0 pointer-events-none -z-10 ${className}`}
            style={{ background: '#111' }} // Fallback bg
        />
    );
}
