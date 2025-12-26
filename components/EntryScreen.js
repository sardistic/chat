"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";

// Whimsical name generator
function generateName(seed) {
    const prefixes = [
        'Fluffy', 'Sparkle', 'Bun', 'Cloud', 'Marshmallow', 'Velvet', 'Cozy', 'Snuggle',
        'Twinkle', 'Star', 'Moon', 'Sun', 'Sky', 'Rain', 'Storm', 'Snow', 'Ice', 'Fire',
        'Bubbles', 'Panda', 'Kitty', 'Puppy', 'Fox', 'Bear', 'Tiger', 'Lion', 'Wolf',
        'Happy', 'Sleepy', 'Dreamy', 'Lucky', 'Sunny', 'Merry', 'Jolly', 'Silly', 'Bouncy',
        'Magic', 'Mystic', 'Crystal', 'Rainbow', 'Glitter', 'Shiny', 'Glow', 'Neon', 'Pixel',
        'Doughnut', 'Cookie', 'Muffin', 'Cupcake', 'Candy', 'Sugar', 'Honey', 'Berry', 'Cherry',
        'Little', 'Tiny', 'Mini', 'Baby', 'Smol', 'Big', 'Mega', 'Giga', 'Ultra', 'Super',
        'Cosmic', 'Astro', 'Lunar', 'Solar', 'Stellar', 'Galactic', 'Orbit', 'Comet', 'Meteor'
    ];
    const suffixes = [
        'Puff', 'Pie', 'Cake', 'Pop', 'Drop', 'Fizzy', 'Soda', 'Shake', 'Cream', 'Tea',
        'Byte', 'Bit', 'Bot', 'Droid', 'Mecha', 'Cyber', 'Data', 'Web', 'Net', 'Link',
        'Mew', 'Woof', 'Purr', 'Roar', 'Hiss', 'Chirp', 'Peep', 'Squeak', 'Honk', 'Beep',
        'Zoom', 'Zap', 'Pow', 'Bam', 'Boom', 'Crash', 'Bang', 'Slap', 'Punch', 'Kick',
        'Wizard', 'Witch', 'Mage', 'Elf', 'Fairy', 'Dragon', 'Ghost', 'Spirit', 'Soul',
        'Leaf', 'Flower', 'Petal', 'Bloom', 'Rose', 'Lily', 'Fern', 'Moss', 'Vine', 'Tree',
        'Gem', 'Jewel', 'Ruby', 'Opal', 'Pearl', 'Gold', 'Silver', 'Copper', 'Iron', 'Steel',
        'Heart', 'Star', 'Moon', 'Sun', 'Cloud', 'Sky', 'Rain', 'Snow', 'Wind', 'Storm'
    ];
    const random = (min, max) => min + Math.floor(Math.abs((Math.sin(seed++) * 10000 % 1)) * (max - min));
    return prefixes[random(0, prefixes.length)] + suffixes[random(0, suffixes.length)] + Math.floor(random(10, 99));
}

// Cookie helper functions
function getCookie(name) {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function setCookie(name, value, days = 365) {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function EntryScreen({ onJoin }) {
    const { data: session, status } = useSession();
    const [username, setUsername] = useState("");
    const [characterSeed, setCharacterSeed] = useState(Date.now());
    const [isLoading, setIsLoading] = useState(true);
    const [guestToken, setGuestToken] = useState(null);

    // Load saved guest data on mount
    useEffect(() => {
        const savedToken = getCookie('guest_token');
        const savedSeed = getCookie('avatar_seed');
        const savedName = getCookie('display_name');

        if (savedToken) {
            setGuestToken(savedToken);
        }
        if (savedSeed) {
            setCharacterSeed(parseInt(savedSeed, 10));
        }
        if (savedName) {
            setUsername(savedName);
        } else {
            setUsername(generateName(savedSeed ? parseInt(savedSeed, 10) : Date.now()));
        }

        setIsLoading(false);
    }, []);

    // Auto-join if user is already logged in with Discord
    useEffect(() => {
        if (status === 'authenticated' && session?.user) {
            // User is logged in with Discord - auto join
            onJoin({
                name: session.user.displayName || session.user.name,
                avatar: session.user.image || session.user.avatarUrl,
                userId: session.user.id,
                role: session.user.role,
                isGuest: false,
                ircConfig: {
                    useIRC: true,
                    host: 'irc.gamesurge.net',
                    port: 6667,
                    nick: session.user.displayName || session.user.name,
                    channel: '#camsrooms',
                    username: session.user.displayName || session.user.name
                }
            });
        }
    }, [status, session, onJoin]);

    // Update seed effect
    useEffect(() => {
        if (characterSeed && !getCookie('display_name')) {
            setUsername(generateName(characterSeed));
        }
    }, [characterSeed]);

    const previewUrl = `/api/avatar/${username || 'guest'}?v=${characterSeed}`;

    const handleGuestJoin = async () => {
        // Save to cookies for persistence
        setCookie('display_name', username);
        setCookie('avatar_seed', characterSeed.toString());

        // Try to register/update guest in database
        try {
            const response = await fetch('/api/guest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestToken,
                    name: username,
                    avatarSeed: characterSeed,
                    avatarUrl: previewUrl,
                }),
            });

            const data = await response.json();
            if (data.success && data.user) {
                // Save the guest token for future visits
                setCookie('guest_token', data.user.guestToken);
                setGuestToken(data.user.guestToken);
            }
        } catch (err) {
            console.warn('Guest registration failed, continuing as ephemeral guest:', err);
        }

        // Join as guest
        onJoin({
            name: username,
            avatar: previewUrl,
            isGuest: true,
            guestToken: guestToken,
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

    const handleDiscordLogin = () => {
        // Use a clean callback URL to prevent parameter accumulation
        signIn('discord', { callbackUrl: '/' });
    };

    const handleRandomize = () => {
        const newSeed = Date.now();
        setCharacterSeed(newSeed);
        setUsername(generateName(newSeed));
    };

    if (isLoading || status === 'loading') {
        return (
            <div className="entry-screen">
                <div className="entry-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="entry-screen">
            <div className="entry-card">
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '8px' }}>CamRooms</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Join the channel</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                    {/* Sprite Preview */}
                    <div style={{ width: '96px', height: '96px', background: '#6366F1', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px rgba(99, 102, 241, 0.25)', overflow: 'hidden' }}>
                        <img
                            src={previewUrl}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn" onClick={handleRandomize} title="Randomize Avatar">🎲 Randomize</button>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                    {/* Discord Login Button */}
                    <button
                        className="btn"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '14px',
                            justifyContent: 'center',
                            background: '#5865F2',
                            border: 'none',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onClick={handleDiscordLogin}
                    >
                        <svg width="20" height="20" viewBox="0 0 71 55" fill="currentColor">
                            <path d="M60.1 4.9A58.5 58.5 0 0045.4.5a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.6a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.4.2.2 0 00-.1.1C1.5 18.2-.9 31 .3 43.7a.2.2 0 00.1.1 58.8 58.8 0 0017.7 8.9.2.2 0 00.2 0 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2 0 58.6 58.6 0 0017.7-8.9.2.2 0 00.1-.1c1.4-14.5-2.4-27.1-10-38.3a.2.2 0 00-.1-.1zM23.7 35.8c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.6-6.7 6-6.7c3.3 0 6 3 6 6.7 0 3.7-2.7 6.7-6 6.7z" />
                        </svg>
                        Login with Discord
                    </button>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>or</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    </div>

                    {/* Guest Join Button */}
                    <button
                        className="btn primary"
                        style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center' }}
                        onClick={handleGuestJoin}
                    >
                        👤 Continue as Guest
                    </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Joining #camsrooms on irc.gamesurge.net
                </div>
            </div>
        </div>
    );
}
