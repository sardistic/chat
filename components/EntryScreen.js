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
    const random = (min, max) => min + Math.floor(Math.abs((Math.sin(seed++) * 10000 % 1)) * (max - min));
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
        onJoin({
            name: username,
            color,
            avatar: spriteImage,
            ircConfig: {
                useIRC: true,
                host: 'irc.gamesurge.net',
                port: 6667,
                nick: username,
                channel: '#camsrooms',
                username: username
            }
        });
    };

    return (
        <div className="entry-screen">
            <div className="entry-card">
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '8px' }}>CamRooms</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Join the channel</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                    {/* Sprite Preview */}
                    <div style={{ width: '96px', height: '96px', background: color, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 20px 40px ${color}40` }}>
                        {spriteImage && <img src={spriteImage} alt="Avatar" style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />}
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn" onClick={() => setCharacterSeed(Date.now())} title="Randomize Avatar">🎲</button>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {colors.map(c => (
                                <div
                                    key={c.hex}
                                    style={{ width: '24px', height: '24px', borderRadius: '50%', background: c.hex, cursor: 'pointer', border: color === c.hex ? '2px solid white' : '2px solid transparent', boxShadow: color === c.hex ? '0 0 0 2px var(--accent-primary)' : 'none' }}
                                    onClick={() => setColor(c.hex)}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Display Name</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="chat-input"
                            style={{ paddingRight: '40px', fontSize: '16px', fontWeight: '500' }}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter name..."
                            maxLength={16}
                        />
                        <button
                            className="btn"
                            style={{ position: 'absolute', right: '4px', top: '4px', padding: '4px 8px', height: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                            onClick={() => setUsername(generateName(Date.now()))}
                            title="Random Name"
                        >
                            ↺
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <button className="btn primary" style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center' }} onClick={handleJoin}>
                        Join Room
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Joining #camsrooms on irc.gamesurge.net
                    </div>
                </div>
            </div>
        </div>
    );
}
