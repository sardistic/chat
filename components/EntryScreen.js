"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { setCookie } from "cookies-next";
import { Icon } from '@iconify/react';

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

    // Simple, robust PRNG (Mulberry32)
    let s = Number(seed) || 123456;
    const random = () => {
        let t = s += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const idx1 = Math.floor(random() * prefixes.length);
    const idx2 = Math.floor(random() * suffixes.length);
    const num = Math.floor(random() * 90) + 10;

    return `${prefixes[idx1]}${suffixes[idx2]}${num}`;
}

// Cookie helper functions
function getCookie(name) {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}




export default function EntryScreen({ onJoin }) {
    const { data: session, status } = useSession();
    const [username, setUsername] = useState("");
    const [characterSeed, setCharacterSeed] = useState(Math.floor(Math.random() * 2147483647));
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

    // Mouse tracking for starmap background highlight
    useEffect(() => {
        const handleMouseMove = (e) => {
            const x = (e.clientX / window.innerWidth) * 100;
            const y = (e.clientY / window.innerHeight) * 100;
            document.documentElement.style.setProperty('--mouse-x', `${x}%`);
            document.documentElement.style.setProperty('--mouse-y', `${y}%`);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Don't auto-join - always show entry screen with options
    // This allows users to choose between Discord login, switch accounts, or guest

    // Update seed effect
    useEffect(() => {
        if (characterSeed && !getCookie('display_name')) {
            setUsername(generateName(characterSeed));
        }
    }, [characterSeed]);

    const previewUrl = `/api/avatar/${username || 'guest'}?v=${characterSeed}`;

    const handleGuestJoin = async () => {
        // Save to cookies for persistence with 1 year expiry
        const options = { maxAge: 60 * 60 * 24 * 365, path: '/' };
        setCookie('display_name', username, options);
        setCookie('avatar_seed', characterSeed.toString(), options);
        if (guestToken) {
            setCookie('guest_token', guestToken, options);
        }

        let startData = {
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
        };

        // Try to register/update guest in database to get ID
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

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    // Update cookie and ID
                    setCookie('guest_token', data.user.guestToken);
                    setGuestToken(data.user.guestToken);
                    startData.id = data.user.id; // Attach DB ID
                }
            } else {
                console.warn('Guest API returned non-200:', response.status);
            }
        } catch (err) {
            console.warn('Guest registration failed, continuing as ephemeral guest:', err);
        }

        // Join as guest
        onJoin(startData);
    };

    const handleDiscordLogin = () => {
        // Use a clean callback URL to prevent parameter accumulation
        signIn('discord', { callbackUrl: '/' });
    };

    const handleRandomize = () => {
        const newSeed = Math.floor(Math.random() * 2147483647);
        setCharacterSeed(newSeed);
        setUsername(generateName(newSeed));
    };

    if (isLoading || status === 'loading') {
        return (
            <div className="entry-screen">
                <div className="starmap-bg" />
                <div className="entry-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '24px', animation: 'spin 3s linear infinite' }}>
                            <Icon icon="fontelico:spin3" width="64" />
                        </div>        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="entry-screen">
            <div className="starmap-bg" />
            <div className="entry-card">
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '8px' }}>Chat</h1>
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
                        <button className="btn" onClick={handleRandomize} title="Randomize Avatar" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <Icon icon="fa:dice" width="18" /> Randomize
                        </button>
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
                            type="button"
                            className="btn icon-btn"
                            onClick={() => setUsername(generateName())}
                            title="Randomize Name"
                        >
                            <Icon icon="fa:random" width="20" />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                    {/* Continue as Discord (if already logged in) */}
                    {status === 'authenticated' && session?.user && (
                        <>
                            <button
                                className="btn"
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    fontSize: '14px',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(135deg, #5865F2, #7289DA)',
                                    border: 'none',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontWeight: '600'
                                }}
                                onClick={() => onJoin({
                                    name: session.user.globalName || session.user.displayName || session.user.name,
                                    avatar: session.user.image || session.user.avatarUrl,
                                    image: session.user.image,
                                    userId: session.user.id,
                                    discordId: session.user.discordId,
                                    globalName: session.user.globalName,
                                    username: session.user.username,
                                    banner: session.user.banner,
                                    accentColor: session.user.accentColor,
                                    premiumType: session.user.premiumType,
                                    publicFlags: session.user.publicFlags,
                                    email: session.user.email,
                                    verified: session.user.verified,
                                    role: session.user.role,
                                    isGuest: false,
                                    ircConfig: {
                                        useIRC: true,
                                        host: 'irc.gamesurge.net',
                                        port: 6667,
                                        nick: session.user.globalName || session.user.displayName || session.user.name,
                                        channel: '#camsrooms',
                                        username: session.user.globalName || session.user.displayName || session.user.name
                                    }
                                })}
                            >
                                <img
                                    src={session.user.image}
                                    alt=""
                                    style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                                />
                                Continue as {session.user.globalName || session.user.name}
                            </button>

                            {/* Divider */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>or</span>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                            </div>
                        </>
                    )}

                    {/* Discord Login Button (for new login or switch account) */}
                    <button
                        className="btn"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '14px',
                            justifyContent: 'center',
                            background: status === 'authenticated' ? 'rgba(88, 101, 242, 0.2)' : '#5865F2',
                            border: status === 'authenticated' ? '1px solid rgba(88, 101, 242, 0.4)' : 'none',
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
                        {status === 'authenticated' ? <><Icon icon="fa:refresh" width="16" /> Switch Discord Account</> : 'Login with Discord'}
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
                        <Icon icon="fa:user" width="16" /> Continue as Guest
                    </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Joining chat on irc.gamesurge.net
                </div>
            </div>
        </div>
    );
}
