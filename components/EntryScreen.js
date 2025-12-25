"use client";

import { useState, useEffect } from "react";

// Procedural sprite generator - creates unique characters from parts
function generateProceduralSprite(seed) {
    const random = (min = 0, max = 1) => {
        const x = Math.sin(seed++) * 10000;
        return min + (x - Math.floor(x)) * (max - min);
    };
    const randInt = (min, max) => Math.floor(random(min, max + 1));
    const choice = (arr) => arr[randInt(0, arr.length - 1)];

    const bodyShapes = ['round', 'tall', 'wide', 'blob', 'triangle', 'square', 'diamond', 'star'];
    const eyeStyles = ['dots', 'happy', 'sleepy', 'angry', 'sparkle', 'heart', 'star', 'spiral', 'robot', 'cat'];
    const mouthStyles = ['smile', 'grin', 'frown', 'fangs', 'tiny', 'wavy', 'zigzag', 'heart', 'none'];
    const accessories = ['none', 'hat', 'bow', 'horns', 'halo', 'antenna', 'crown', 'flower', 'headphones', 'wings'];
    const patterns = ['solid', 'spots', 'stripes', 'gradient', 'sparkles', 'checkers'];

    return {
        bodyShape: choice(bodyShapes),
        eyeStyle: choice(eyeStyles),
        mouthStyle: choice(mouthStyles),
        accessory: choice(accessories),
        pattern: choice(patterns),
        size: random(0.8, 1.2),
        rotation: randInt(-5, 5),
        seed
    };
}

// Draw sprite on canvas (Simplified for brevity)
function drawSprite(sprite, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const centerX = 120;
    const centerY = 120;
    const baseSize = 80 * sprite.size;

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
    };
    const rgb = hexToRgb(color);
    const primaryColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((sprite.rotation * Math.PI) / 180);

    // Draw simple shape
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-20, -10, 8, 0, Math.PI * 2);
    ctx.arc(20, -10, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return canvas.toDataURL();
}

function generateName(seed) {
    const prefixes = ['Pixel', 'Byte', 'Net', 'Cyber', 'Data', 'Web', 'Tech', 'Code', 'Soft', 'Hard'];
    const suffixes = ['User', 'Dev', 'Ops', 'Bot', 'Admin', 'Guest', 'Mancer', 'Runner', 'Surfer', 'Glider'];
    const random = (min, max) => min + Math.floor((Math.sin(seed++) * 10000 % 1) * (max - min));
    return prefixes[random(0, prefixes.length)] + suffixes[random(0, suffixes.length)] + Math.floor(random(10, 99));
}

export default function EntryScreen({ onJoin }) {
    const [username, setUsername] = useState("");
    const [color, setColor] = useState("#A78BFA"); // Default railway purple
    const [characterSeed, setCharacterSeed] = useState(Date.now());
    const [spriteImage, setSpriteImage] = useState(null);

    const colors = [
        { hex: "#A78BFA", name: "Purple" },
        { hex: "#34D399", name: "Emerald" },
        { hex: "#60A5FA", name: "Blue" },
        { hex: "#F87171", name: "Red" },
        { hex: "#FBBF24", name: "Amber" },
        { hex: "#9CA3AF", name: "Grey" },
    ];

    useEffect(() => {
        const newSprite = generateProceduralSprite(characterSeed);
        const img = drawSprite(newSprite, color);
        setSpriteImage(img);
        setUsername(generateName(characterSeed));
    }, [color, characterSeed]);

    const handleJoin = () => {
        onJoin({ name: username, color, avatar: spriteImage });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'var(--bg-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
        }}>
            <div className="panel-card" style={{
                width: '100%', maxWidth: '400px',
                padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Join Session</h2>
                    <p className="text-muted" style={{ fontSize: '14px', margin: 0 }}>
                        Configure your identity
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{
                        width: '96px', height: '96px',
                        background: 'var(--bg-input)',
                        borderRadius: '12px', overflow: 'hidden',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        {spriteImage && <img src={spriteImage} style={{ width: '100%', height: '100%' }} />}
                    </div>
                </div>

                {/* Name Input */}
                <div>
                    <label className="text-secondary" style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                        DISPLAY NAME
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            className="chat-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <button className="btn" onClick={() => setCharacterSeed(Math.random())} title="Randomize">
                            🎲
                        </button>
                    </div>
                </div>

                {/* Color Picker */}
                <div>
                    <label className="text-secondary" style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                        ACCENT COLOR
                    </label>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                        {colors.map(c => (
                            <button
                                key={c.hex}
                                onClick={() => setColor(c.hex)}
                                style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: c.hex, border: 'none', cursor: 'pointer',
                                    outline: color === c.hex ? '2px solid white' : 'none',
                                    outlineOffset: '2px'
                                }}
                            />
                        ))}
                    </div>
                </div>

                <button className="btn primary" style={{ padding: '12px', fontSize: '14px' }} onClick={handleJoin}>
                    Connect to Server
                </button>
            </div>
        </div>
    );
}
