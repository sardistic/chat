"use client";

import { useState, useEffect } from "react";

// Procedural sprite generator - creates unique characters from parts
function generateProceduralSprite(seed) {
    // Seeded random number generator
    const random = (min = 0, max = 1) => {
        const x = Math.sin(seed++) * 10000;
        return min + (x - Math.floor(x)) * (max - min);
    };

    const randInt = (min, max) => Math.floor(random(min, max + 1));
    const choice = (arr) => arr[randInt(0, arr.length - 1)];

    // Body shapes (16x16 base)
    const bodyShapes = [
        'round', 'tall', 'wide', 'blob', 'triangle', 'square', 'diamond', 'star'
    ];

    // Eye styles
    const eyeStyles = [
        'dots', 'happy', 'sleepy', 'angry', 'sparkle', 'heart', 'star', 'spiral', 'robot', 'cat'
    ];

    // Mouth styles
    const mouthStyles = [
        'smile', 'grin', 'frown', 'fangs', 'tiny', 'wavy', 'zigzag', 'heart', 'none'
    ];

    // Accessories
    const accessories = [
        'none', 'hat', 'bow', 'horns', 'halo', 'antenna', 'crown', 'flower', 'headphones', 'wings'
    ];

    // Patterns
    const patterns = [
        'solid', 'spots', 'stripes', 'gradient', 'sparkles', 'checkers'
    ];

    return {
        bodyShape: choice(bodyShapes),
        eyeStyle: choice(eyeStyles),
        mouthStyle: choice(mouthStyles),
        accessory: choice(accessories),
        pattern: choice(patterns),
        primaryHue: randInt(0, 360),
        secondaryHue: randInt(0, 360),
        size: random(0.8, 1.2),
        rotation: randInt(-5, 5),
        seed
    };
}

// Draw sprite on canvas
function drawSprite(sprite, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    const centerX = 120;
    const centerY = 120;
    const baseSize = 80 * sprite.size;

    // Helper to convert hex to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 212, b: 255 };
    };

    const rgb = hexToRgb(color);
    const primaryColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const secondaryColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
    const highlightColor = `rgba(${Math.min(rgb.r + 50, 255)}, ${Math.min(rgb.g + 50, 255)}, ${Math.min(rgb.b + 50, 255)}, 0.8)`;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((sprite.rotation * Math.PI) / 180);

    // Draw body based on shape
    ctx.fillStyle = primaryColor;
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 3;

    switch (sprite.bodyShape) {
        case 'round':
            ctx.beginPath();
            ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
        case 'tall':
            ctx.fillRect(-baseSize * 0.5, -baseSize * 1.2, baseSize, baseSize * 2.4);
            ctx.strokeRect(-baseSize * 0.5, -baseSize * 1.2, baseSize, baseSize * 2.4);
            break;
        case 'wide':
            ctx.fillRect(-baseSize * 1.2, -baseSize * 0.5, baseSize * 2.4, baseSize);
            ctx.strokeRect(-baseSize * 1.2, -baseSize * 0.5, baseSize * 2.4, baseSize);
            break;
        case 'blob':
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const radius = baseSize * (0.8 + Math.sin(sprite.seed + i) * 0.3);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
        case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0, -baseSize);
            ctx.lineTo(-baseSize, baseSize);
            ctx.lineTo(baseSize, baseSize);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
        case 'square':
            ctx.fillRect(-baseSize, -baseSize, baseSize * 2, baseSize * 2);
            ctx.strokeRect(-baseSize, -baseSize, baseSize * 2, baseSize * 2);
            break;
        case 'diamond':
            ctx.beginPath();
            ctx.moveTo(0, -baseSize * 1.2);
            ctx.lineTo(baseSize, 0);
            ctx.lineTo(0, baseSize * 1.2);
            ctx.lineTo(-baseSize, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
        case 'star':
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const radius = i % 2 === 0 ? baseSize : baseSize * 0.5;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
    }

    // Draw pattern
    if (sprite.pattern !== 'solid') {
        ctx.fillStyle = secondaryColor;
        switch (sprite.pattern) {
            case 'spots':
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2;
                    const x = Math.cos(angle) * baseSize * 0.5;
                    const y = Math.sin(angle) * baseSize * 0.5;
                    ctx.beginPath();
                    ctx.arc(x, y, baseSize * 0.15, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'stripes':
                for (let i = -baseSize; i < baseSize; i += baseSize * 0.3) {
                    ctx.fillRect(i, -baseSize * 1.5, baseSize * 0.15, baseSize * 3);
                }
                break;
        }
    }

    // Draw eyes
    ctx.fillStyle = highlightColor;
    const eyeY = -baseSize * 0.3;
    const eyeSpacing = baseSize * 0.4;

    switch (sprite.eyeStyle) {
        case 'dots':
            ctx.beginPath();
            ctx.arc(-eyeSpacing, eyeY, baseSize * 0.1, 0, Math.PI * 2);
            ctx.arc(eyeSpacing, eyeY, baseSize * 0.1, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'happy':
            ctx.beginPath();
            ctx.arc(-eyeSpacing, eyeY, baseSize * 0.15, 0, Math.PI);
            ctx.arc(eyeSpacing, eyeY, baseSize * 0.15, 0, Math.PI);
            ctx.fill();
            break;
        case 'sparkle':
            [-eyeSpacing, eyeSpacing].forEach(x => {
                ctx.fillRect(x - 2, eyeY - 8, 4, 16);
                ctx.fillRect(x - 8, eyeY - 2, 16, 4);
            });
            break;
        case 'heart':
            [-eyeSpacing, eyeSpacing].forEach(x => {
                ctx.font = `${baseSize * 0.3}px Arial`;
                ctx.fillText('♥', x - baseSize * 0.1, eyeY + baseSize * 0.1);
            });
            break;
    }

    // Draw mouth
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 4;
    const mouthY = baseSize * 0.3;

    switch (sprite.mouthStyle) {
        case 'smile':
            ctx.beginPath();
            ctx.arc(0, mouthY - baseSize * 0.2, baseSize * 0.4, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
            break;
        case 'grin':
            ctx.beginPath();
            ctx.arc(0, mouthY - baseSize * 0.3, baseSize * 0.5, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
            break;
        case 'tiny':
            ctx.beginPath();
            ctx.arc(0, mouthY, baseSize * 0.08, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'wavy':
            ctx.beginPath();
            ctx.moveTo(-baseSize * 0.3, mouthY);
            ctx.quadraticCurveTo(-baseSize * 0.15, mouthY + 10, 0, mouthY);
            ctx.quadraticCurveTo(baseSize * 0.15, mouthY - 10, baseSize * 0.3, mouthY);
            ctx.stroke();
            break;
    }

    // Draw accessory
    ctx.fillStyle = highlightColor;
    switch (sprite.accessory) {
        case 'hat':
            ctx.fillRect(-baseSize * 0.6, -baseSize * 1.3, baseSize * 1.2, baseSize * 0.2);
            ctx.fillRect(-baseSize * 0.4, -baseSize * 1.6, baseSize * 0.8, baseSize * 0.3);
            break;
        case 'horns':
            ctx.beginPath();
            ctx.moveTo(-baseSize * 0.7, -baseSize * 0.8);
            ctx.lineTo(-baseSize * 0.9, -baseSize * 1.3);
            ctx.lineTo(-baseSize * 0.5, -baseSize * 0.9);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(baseSize * 0.7, -baseSize * 0.8);
            ctx.lineTo(baseSize * 0.9, -baseSize * 1.3);
            ctx.lineTo(baseSize * 0.5, -baseSize * 0.9);
            ctx.fill();
            break;
        case 'halo':
            ctx.strokeStyle = highlightColor;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(0, -baseSize * 1.4, baseSize * 0.5, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'antenna':
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, -baseSize);
            ctx.lineTo(0, -baseSize * 1.4);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -baseSize * 1.5, baseSize * 0.15, 0, Math.PI * 2);
            ctx.fill();
            break;
    }

    ctx.restore();
    return canvas.toDataURL();
}

// Generate cute names
function generateName(seed) {
    const random = (min = 0, max = 1) => {
        const x = Math.sin(seed++) * 10000;
        return min + (x - Math.floor(x)) * (max - min);
    };
    const randInt = (min, max) => Math.floor(random(min, max + 1));
    const choice = (arr) => arr[randInt(0, arr.length - 1)];

    const prefixes = ['Pixel', 'Byte', 'Cyber', 'Neo', 'Star', 'Luna', 'Nova', 'Cosmo', 'Astro', 'Quantum', 'Digital', 'Neon', 'Retro', 'Mega', 'Ultra', 'Hyper', 'Turbo', 'Super', 'Glitch', 'Data'];
    const middles = ['Pal', 'Buddy', 'Friend', 'Mate', 'Bean', 'Sprite', 'Bot', 'Dude', 'Gal', 'Guy', 'Kid', 'Pup', 'Cub', 'Bit', 'Wave', 'Vibe', 'Soul', 'Heart', 'Mind', 'Core'];
    const suffixes = ['', '2000', 'X', 'Pro', 'Max', 'Plus', 'Prime', 'Ultra', 'Mega', 'Super', 'Jr', 'Sr', '64', '128', '256'];

    return choice(prefixes) + choice(middles) + choice(suffixes);
}

export default function EntryScreen({ onJoin }) {
    const [username, setUsername] = useState("");
    const [color, setColor] = useState("#00d4ff");
    const [agreed, setAgreed] = useState(false);
    const [characterSeed, setCharacterSeed] = useState(Math.random() * 100000);
    const [sprite, setSprite] = useState(null);
    const [spriteImage, setSpriteImage] = useState(null);
    const [isEditingName, setIsEditingName] = useState(false);

    const colors = [
        { hex: "#00d4ff", name: "Cyan" },
        { hex: "#b794f6", name: "Purple" },
        { hex: "#ff6b9d", name: "Pink" },
        { hex: "#10b981", name: "Green" },
        { hex: "#f59e0b", name: "Amber" },
        { hex: "#ef4444", name: "Red" },
    ];

    useEffect(() => {
        const newSprite = generateProceduralSprite(characterSeed);
        setSprite(newSprite);
        const img = drawSprite(newSprite, color);
        setSpriteImage(img);
        if (!isEditingName) {
            setUsername(generateName(characterSeed));
        }
    }, [color, characterSeed]);

    const handleRoll = () => {
        setCharacterSeed(Math.random() * 100000);
        setIsEditingName(false);
    };

    const handleEnter = () => {
        if (!username.trim()) {
            alert("Please enter a username.");
            return;
        }
        if (!agreed) {
            alert("You must agree to the Terms of Service.");
            return;
        }
        onJoin({ name: username, color, avatar: spriteImage });
    };

    const handleGuest = () => {
        if (!agreed) {
            alert("You must agree to the Terms of Service.");
            return;
        }
        onJoin({ name: `Guest_${Math.floor(Math.random() * 1000)}`, color: '#00d4ff', avatar: spriteImage });
    };

    return (
        <div className="entry-overlay">
            <div style={{
                width: '100%',
                maxWidth: '520px',
                padding: '40px',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, .15)',
                background: 'rgba(10, 14, 26, .95)',
                backdropFilter: 'blur(40px)',
                boxShadow: '0 30px 80px rgba(0, 0, 0, .6), 0 0 100px rgba(0, 212, 255, .1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '32px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Animated background glow */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    background: 'radial-gradient(circle, rgba(0, 212, 255, .08) 0%, transparent 70%)',
                    animation: 'rotate 20s linear infinite',
                    pointerEvents: 'none'
                }}></div>

                {/* Header */}
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    <h1 style={{
                        margin: '0 0 8px',
                        fontSize: '32px',
                        fontWeight: '800',
                        background: 'linear-gradient(135deg, #00d4ff, #b794f6)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        letterSpacing: '-1px'
                    }}>
                        Welcome, chat
                    </h1>
                    <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: 'var(--muted)',
                        fontWeight: '500'
                    }}>
                        Roll your unique character • Hundreds of combinations
                    </p>
                </div>

                {/* Character Generator */}
                <div style={{
                    padding: '32px',
                    borderRadius: '20px',
                    background: 'rgba(0, 0, 0, .4)',
                    border: '1px solid rgba(255, 255, 255, .08)',
                    textAlign: 'center',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--muted)',
                        marginBottom: '16px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        Your Character
                    </div>

                    {/* Procedurally Generated Sprite */}
                    <div style={{
                        display: 'inline-block',
                        padding: '24px',
                        borderRadius: '20px',
                        background: 'rgba(0, 0, 0, .3)',
                        marginBottom: '20px',
                        boxShadow: `0 0 50px ${color}50, inset 0 0 30px ${color}20`,
                        position: 'relative'
                    }}>
                        {spriteImage && (
                            <img
                                src={spriteImage}
                                alt="Character"
                                style={{
                                    width: '240px',
                                    height: '240px',
                                    imageRendering: 'pixelated',
                                    filter: `drop-shadow(0 0 20px ${color}80)`
                                }}
                            />
                        )}
                    </div>

                    {/* Username Display/Edit */}
                    <div style={{ marginBottom: '16px' }}>
                        {isEditingName ? (
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                                autoFocus
                                style={{
                                    fontSize: '24px',
                                    fontWeight: '700',
                                    color: color,
                                    textShadow: `0 0 20px ${color}80`,
                                    background: 'rgba(0, 0, 0, .3)',
                                    border: `1px solid ${color}40`,
                                    borderRadius: '8px',
                                    padding: '8px 16px',
                                    textAlign: 'center',
                                    outline: 'none',
                                    width: '80%'
                                }}
                            />
                        ) : (
                            <div style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                color: color,
                                textShadow: `0 0 20px ${color}80, 0 0 40px ${color}40`,
                                letterSpacing: '-.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                {username || "Username"}
                                <button
                                    onClick={() => setIsEditingName(true)}
                                    style={{
                                        background: 'rgba(255, 255, 255, .08)',
                                        border: '1px solid rgba(255, 255, 255, .15)',
                                        borderRadius: '8px',
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: 'var(--muted)',
                                        transition: 'all .2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, .12)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, .08)';
                                    }}
                                >
                                    ✏️
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Roll Button */}
                    <button
                        onClick={handleRoll}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, .2)',
                            background: 'rgba(255, 255, 255, .08)',
                            color: 'var(--text)',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all .2s',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, .2)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 8px 24px rgba(0, 0, 0, .3)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, .2)';
                        }}
                    >
                        🎲 Roll New Character
                    </button>
                </div>

                {/* Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', zIndex: 1 }}>
                    {/* Color Picker */}
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '10px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'var(--text)',
                            letterSpacing: '.3px'
                        }}>
                            Character Color
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(6, 1fr)',
                            gap: '12px'
                        }}>
                            {colors.map((c) => (
                                <button
                                    key={c.hex}
                                    onClick={() => setColor(c.hex)}
                                    style={{
                                        width: '100%',
                                        aspectRatio: '1',
                                        borderRadius: '12px',
                                        background: c.hex,
                                        border: color === c.hex ? `3px solid ${c.hex}` : '2px solid rgba(255, 255, 255, .15)',
                                        cursor: 'pointer',
                                        transition: 'all .2s',
                                        boxShadow: color === c.hex
                                            ? `0 0 0 4px rgba(255, 255, 255, .1), 0 8px 24px ${c.hex}60, 0 0 40px ${c.hex}40`
                                            : '0 4px 12px rgba(0, 0, 0, .3)',
                                        transform: color === c.hex ? 'scale(1.1)' : 'scale(1)',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (color !== c.hex) {
                                            e.target.style.transform = 'scale(1.05)';
                                            e.target.style.boxShadow = `0 6px 18px ${c.hex}40`;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (color !== c.hex) {
                                            e.target.style.transform = 'scale(1)';
                                            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, .3)';
                                        }
                                    }}
                                >
                                    {color === c.hex && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: '18px'
                                        }}>✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Agreement */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: 'var(--muted)',
                        lineHeight: '1.6'
                    }}>
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            style={{
                                width: '20px',
                                height: '20px',
                                marginTop: '2px',
                                cursor: 'pointer',
                                accentColor: color
                            }}
                        />
                        <span>
                            I agree to the Terms of Service and acknowledge this is a public broadcast environment.
                        </span>
                    </label>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleGuest}
                            style={{
                                flex: '1',
                                padding: '16px',
                                borderRadius: '14px',
                                border: '1px solid rgba(255, 255, 255, .15)',
                                background: 'rgba(255, 255, 255, .08)',
                                color: 'var(--text)',
                                fontSize: '15px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all .2s',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, .2)'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 8px 24px rgba(0, 0, 0, .3)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, .2)';
                            }}
                        >
                            Guest
                        </button>
                        <button
                            onClick={handleEnter}
                            style={{
                                flex: '2',
                                padding: '16px',
                                borderRadius: '14px',
                                border: `1px solid ${color}66`,
                                background: `linear-gradient(135deg, ${color}40, ${color}20)`,
                                color: 'var(--text)',
                                fontSize: '15px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all .2s',
                                boxShadow: `0 4px 20px ${color}50, 0 0 40px ${color}30`
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = `0 8px 30px ${color}60, 0 0 60px ${color}40`;
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = `0 4px 20px ${color}50, 0 0 40px ${color}30`;
                            }}
                        >
                            Enter Room →
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
