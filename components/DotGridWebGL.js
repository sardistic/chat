"use client"; // Build test

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RIPPLE_PRESETS, rippleCallbacks } from './DotGridRegistry';

// Import from Registry not locally defined
// Note: We use the Registry for shared state

/**
 * DotGridWebGL - GPU Implementation (Performance)
 */
export default function DotGridWebGL({ className = '', zoomLevel = 0 }) {
    const containerRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });

    // Shader Uniforms References
    const uniformsRef = useRef({
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(-1000, -1000) },
        uScreenSize: { value: new THREE.Vector2(1, 1) },
        uZoom: { value: 0 },
        uDragFactor: { value: 1.0 },
        uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1 },
        // Ripples (Max 20 active)
        uRipples: { value: new Array(20).fill(new THREE.Vector3(0, 0, -1)) },
        uRippleParams: { value: new Array(20).fill(new THREE.Vector3(0, 0, 0)) },
    });

    const activeRipples = useRef([]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // --- SCENE SETUP ---
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000);
        camera.position.z = 10;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // --- GEOMETRY ---
        const gridSize = 45;
        const cols = Math.ceil(window.innerWidth / gridSize) + 2;
        const rows = Math.ceil(window.innerHeight / gridSize) + 2;
        const count = cols * rows;

        const positions = new Float32Array(count * 3);
        const randoms = new Float32Array(count);

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
            uniform float uPixelRatio; 
            
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
                    float fade = uRippleParams[i].y; // 1.0 at start, 0.0 at end
                    
                    float d = distance(pos.xy, ripPos);
                    float distFromRing = abs(d - radius);
                    
                    if (distFromRing < width) {
                        float t = 1.0 - (distFromRing / width);
                        totalRippleInf += t * t * fade; // Apply fade factor
                    }
                }
                totalRippleInf = clamp(totalRippleInf, 0.0, 1.0);

                // --- SIZING ---
                float baseSize = 2.5; // Small base dots
                float growSize = baseSize * 12.0 * falloff; // SUPER hover growth
                float waveSize = baseSize * 0.3 * waveNorm; // Subtle wave 
                float ripSize = baseSize * 1.2 * totalRippleInf; // Subtle ripple size
                
                vSize = baseSize + growSize + waveSize + ripSize;
                
                if (uDragFactor > 0.3) {
                     vSize *= (0.8 + 0.5 * uDragFactor); 
                } else {
                     vSize *= 0.6; 
                }
                
                gl_PointSize = vSize * (1.0 + uZoom * 0.2) * uPixelRatio;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                
                // --- COLOR / OPACITY ---
                float baseOp = 0.15; 
                float opacity = baseOp + (falloff * 0.6) + (waveNorm * 0.15) + (totalRippleInf * 0.1); // Subtle ripple opacity
                
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
                vec2 coord = gl_PointCoord - vec2(0.5);
                float dist = length(coord);
                if (dist > 0.5) discard;
                
                float delta = 0.05;
                float alpha = 1.0 - smoothstep(0.45 - delta, 0.45, dist);
                
                if (uDragFactor > 0.3) {
                     float innerStroke = 1.0 - smoothstep(0.35, 0.35 + delta, dist);
                     alpha -= innerStroke;
                     alpha = max(0.0, alpha);
                }
                
                gl_FragColor = vec4(vColor, vOpacity * alpha);
            }
        `;

        // Create 5 Layers 
        const layersData = [
            { drag: 1.0, z: 0 },   // Outer
            { drag: 0.8, z: 1 },
            { drag: 0.6, z: 2 },
            { drag: 0.4, z: 3 },
            { drag: 0.2, z: 4 }    // Core
        ];

        layersData.forEach(layer => {
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    ...uniformsRef.current,
                    uDragFactor: { value: layer.drag }
                },
                vertexShader,
                fragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Points(geometry, material);
            scene.add(mesh);
        });

        // --- RESIZE ---
        camera.left = 0; camera.right = window.innerWidth;
        camera.top = 0; camera.bottom = window.innerHeight;
        camera.updateProjectionMatrix();

        const handleResize = () => {
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

            uniformsRef.current.uTime.value = time;

            // Mouse Lerp
            const targetX = mouseRef.current.targetX || -1000;
            const targetY = mouseRef.current.targetY || -1000;
            const curX = uniformsRef.current.uMouse.value.x;
            const curY = uniformsRef.current.uMouse.value.y;

            uniformsRef.current.uMouse.value.x += (targetX - curX) * 0.4;
            uniformsRef.current.uMouse.value.y += (targetY - curY) * 0.4;

            // Ripple Logic
            const ripples = activeRipples.current;
            const uRipples = uniformsRef.current.uRipples.value;
            const uRippleParams = uniformsRef.current.uRippleParams.value;

            for (let i = 0; i < 20; i++) uRipples[i].z = -1;

            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.radius += r.speed;

                // Calculate fade: 1.0 at start, smoothly goes to 0 as it approaches maxRadius
                // Start fading at 60% of max radius
                const fadeStartRatio = 0.6;
                const progress = r.radius / r.maxRadius;
                const fade = progress < fadeStartRatio
                    ? 1.0
                    : 1.0 - ((progress - fadeStartRatio) / (1.0 - fadeStartRatio));

                if (i < 20) {
                    uRipples[i].set(r.x, r.y, r.radius);
                    uRippleParams[i].set(r.width, Math.max(0, fade), 0);
                }

                // Remove ripple when fully faded
                if (r.radius > r.maxRadius) {
                    ripples.splice(i, 1);
                }
            }

            renderer.render(scene, camera);
        };
        animate();

        // --- INPUTS ---
        const handleMouseMove = (e) => {
            mouseRef.current.targetX = e.clientX;
            mouseRef.current.targetY = e.clientY;
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Ripple Listener
        const rippleHandler = (type, origin, color, intensity) => {
            const preset = RIPPLE_PRESETS[type] || RIPPLE_PRESETS.message;
            const rx = origin?.x ?? window.innerWidth;
            const ry = origin?.y ?? window.innerHeight * 0.8;
            activeRipples.current.push({
                x: rx,
                y: ry,
                radius: 0,
                speed: preset.speed,
                width: preset.width,
                maxRadius: preset.maxRadius || window.innerWidth * 1.5
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
            style={{ background: '#080808' }}
        />
    );
}
