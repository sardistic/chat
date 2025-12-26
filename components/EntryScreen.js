"use client";

import { useState, useEffect } from "react";

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
        // When seed changes, just update name. Image updates via URL.
        // We only generate a name if the user hasn't typed a custom one (or maybe we just always sync them for 'randomize' button?)
        // The 'Randomize' button updates 'characterSeed'.
        if (characterSeed) {
            // Optional: If we want to randomize name with seed, we can.
            // But existing logic was: new seed -> new sprite AND new name.
            // We'll keep that behavior for the "Dice" button.
            setUsername(generateName(characterSeed));
        }
    }, [characterSeed]);

    // Construct avatar URL
    // We use username + seed to ensure uniqueness.
    // If username is empty, use 'guest'.
    const previewUrl = `/api/avatar/${username || 'guest'}?v=${characterSeed}`;

    const handleJoin = () => {
        onJoin({
            name: username,
            color,
            avatar: previewUrl, // Pass the URL effectively
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
                    <div style={{ width: '96px', height: '96px', background: color, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 20px 40px ${color}40`, overflow: 'hidden' }}>
                        <img
                            src={previewUrl}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
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
