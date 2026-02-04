"use client";

import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { setCookie } from "cookies-next";
import { Icon } from '@iconify/react';
import RoomBrowser from './RoomBrowser';
import Background, { useBackground, BACKGROUND_TYPES } from './Background';
import SettingsModal from './SettingsModal';

// Expanded name generator with gaming/internet culture
function generateName(seed) {
    // Gaming icons, meme lords, internet culture
    const gamingPrefixes = [
        // Classic Gaming
        'Mario', 'Luigi', 'Sonic', 'Tails', 'Link', 'Zelda', 'Samus', 'Kirby', 'Pikachu', 'Charizard',
        'Cloud', 'Sephiroth', 'Tifa', 'Aerith', 'Squall', 'Tidus', 'Yuna', 'Auron', 'Vivi', 'Zidane',
        // Modern Gaming
        'Master', 'Chief', 'Kratos', 'Geralt', 'Ciri', 'Ellie', 'Joel', 'Nathan', 'Drake', 'Lara',
        'Solid', 'Snake', 'Big', 'Boss', 'Raiden', 'Dante', 'Vergil', 'Nero', 'Leon', 'Jill',
        // Esports/Streaming
        'Ninja', 'Shroud', 'Summit', 'xQc', 'Toast', 'Sykkuno', 'Ludwig', 'Myth', 'Tfue', 'Tim',
        // League/DOTA
        'Faker', 'Dopa', 'Caps', 'Perkz', 'Bjerg', 'Doublelift', 'Sneaky', 'Rush', 'Jankos', 'Rekkles',
        // Anime/Manga
        'Goku', 'Vegeta', 'Naruto', 'Sasuke', 'Luffy', 'Zoro', 'Ichigo', 'Eren', 'Levi', 'Mikasa',
        'Tanjiro', 'Nezuko', 'Gojo', 'Sukuna', 'Denji', 'Power', 'Makima', 'Anya', 'Spy', 'Family',
        // Memes & Internet
        'Doge', 'Pepe', 'Wojak', 'Chad', 'Sigma', 'Based', 'Cringe', 'Pog', 'Kappa', 'Monka',
        'Stonks', 'Diamond', 'Ape', 'Moon', 'Hodl', 'Yeet', 'Vibe', 'Ratio', 'Cope', 'Seethe',
        // Minecraft/Roblox
        'Steve', 'Alex', 'Herobrine', 'Notch', 'Dream', 'George', 'Sapnap', 'Techno', 'Philza', 'Wilbur',
        // Valorant/CS
        'Jett', 'Phoenix', 'Sage', 'Reyna', 'Omen', 'Killjoy', 'Cypher', 'Sova', 'Breach', 'Skye',
        // Overwatch
        'Tracer', 'Genji', 'Mercy', 'Dva', 'Hanzo', 'Widow', 'Reaper', 'Soldier', 'Pharah', 'Echo',
        // Fortnite/BR
        'Noob', 'Bot', 'Sweat', 'Tryhard', 'Default', 'Cranking', 'Boxed', 'Goated', 'Cracked', 'Bussin',
        // Pokemon
        'Ash', 'Misty', 'Brock', 'Gary', 'Red', 'Blue', 'Cynthia', 'Leon', 'Mewtwo', 'Mew',
        // Among Us era
        'Sus', 'Vent', 'Imposter', 'Crew', 'Emergency', 'Voted', 'Ejected', 'Task', 'Sabotage', 'Report'
    ];

    const suffixes = [
        // Gaming terms
        'Main', 'Pro', 'Noob', 'God', 'King', 'Queen', 'Lord', 'Master', 'Sensei', 'Sama',
        'Chan', 'Kun', 'San', 'Senpai', 'Kouhai', 'Kami', 'Dono', 'Hime', 'Ouji', 'Neko',
        // Gamer tags
        'Gaming', 'Plays', 'Stream', 'Live', 'TV', 'YT', 'TTV', 'Official', 'Real', 'Actual',
        'xD', 'UwU', 'OwO', 'QQ', 'GG', 'WP', 'EZ', 'FF', 'AFK', 'BRB',
        // Numbers/Leet
        '69', '420', '1337', '9000', '360', '180', '2024', '99', '100', 'Max',
        // Adjectives
        'Dark', 'Light', 'Shadow', 'Void', 'Chaos', 'Order', 'True', 'False', 'Real', 'Fake',
        'Ultra', 'Mega', 'Giga', 'Hyper', 'Super', 'Omega', 'Alpha', 'Beta', 'Sigma', 'Delta',
        // Internet suffixes
        'Moment', 'Hours', 'Mode', 'Core', 'Pilled', 'Maxxing', 'Wave', 'Era', 'Arc', 'Saga'
    ];

    // Simple, robust PRNG (Mulberry32)
    let s = Number(seed) || 123456;
    const random = () => {
        let t = s += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const idx1 = Math.floor(random() * gamingPrefixes.length);
    const idx2 = Math.floor(random() * suffixes.length);

    // Sometimes add a number, sometimes don't
    const addNumber = random() > 0.4;
    const num = addNumber ? Math.floor(random() * 999) : '';

    return `${gamingPrefixes[idx1]}${suffixes[idx2]}${num}`;
}

// Sanitize username for IRC compatibility
// IRC rules: alphanumeric + _-[] only, starts with letter, 2-20 chars
function sanitizeUsername(name) {
    if (!name) return 'Guest';

    // Remove any characters that aren't alphanumeric, underscore, hyphen
    let sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '');

    // Must start with a letter
    if (!/^[a-zA-Z]/.test(sanitized)) {
        sanitized = 'G' + sanitized;
    }

    // Enforce length limits (2-20 chars)
    if (sanitized.length < 2) {
        sanitized = sanitized + 'Guest';
    }
    if (sanitized.length > 20) {
        sanitized = sanitized.substring(0, 20);
    }

    return sanitized;
}

// Cookie helper functions
function getCookie(name) {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}




import ProfileModal from "@/components/ProfileModal";

export default function EntryScreen({ onJoin, initialRoom = null }) {
    const { data: session, status, update } = useSession();
    const [username, setUsername] = useState("");
    const [characterSeed, setCharacterSeed] = useState(Math.floor(Math.random() * 2147483647));
    const [isLoading, setIsLoading] = useState(true);
    const [guestToken, setGuestToken] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(initialRoom); // Room selection step
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // Feature States
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showStatusInput, setShowStatusInput] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [customStatus, setCustomStatus] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Zoom Transition Logic
    const [zoomLevel, setZoomLevel] = useState(0);

    useEffect(() => {
        if (selectedRoom) setZoomLevel(1);
        else setZoomLevel(0);
    }, [selectedRoom]);

    const handleJoinWithZoom = (data) => {
        setZoomLevel(2); // Trigger "Warp Speed" zoom
        setTimeout(() => {
            onJoin(data);
        }, 800); // Wait for transition before unmounting/switching
    };

    // Load saved guest data on mount
    useEffect(() => {
        const savedToken = getCookie('guest_token');
        const savedSeed = getCookie('avatar_seed');
        const savedName = getCookie('display_name');

        if (savedToken) {
            setGuestToken(savedToken);
        }
        let initialSeed = savedSeed ? parseInt(savedSeed, 10) : null;
        if (!initialSeed || isNaN(initialSeed)) {
            initialSeed = Math.floor(Math.random() * 2147483647);
        }
        setCharacterSeed(initialSeed);

        if (savedName && savedName !== 'null' && savedName !== 'undefined') {
            setUsername(savedName);
        } else {
            setUsername(generateName(initialSeed));
        }

        setIsLoading(false);
    }, []);

    // Mouse tracking for starmap background highlight
    useEffect(() => {
        let ticking = false;
        const handleMouseMove = (e) => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const x = (e.clientX / window.innerWidth) * 100;
                    const y = (e.clientY / window.innerHeight) * 100;
                    document.documentElement.style.setProperty('--mouse-x', `${x}%`);
                    document.documentElement.style.setProperty('--mouse-y', `${y}%`);
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Don't auto-join - always show entry screen with options
    // This allows users to choose between Discord login, switch accounts, or guest

    // Sync Discord data if available
    useEffect(() => {
        if (status === 'authenticated' && session?.user) {
            // Priority: custom_nick cookie (from /nick) > DB displayName > Discord globalName > name
            const customNick = getCookie('custom_nick');
            const discordName = customNick || session.user.displayName || session.user.globalName || session.user.name;
            if (discordName) setUsername(sanitizeUsername(discordName));
        }
    }, [status, session]);

    // Update seed effect (only if not authenticated or name explictly set)
    useEffect(() => {
        if (status !== 'authenticated' && characterSeed && !getCookie('display_name')) {
            setUsername(generateName(characterSeed));
        }
    }, [characterSeed, status]);

    const isDiscordUser = status === 'authenticated' && session?.user;
    const previewUrl = isDiscordUser
        ? (session.user.image || session.user.avatarUrl)
        : `/api/avatar/${sanitizeUsername(username) || 'guest'}?v=${characterSeed}`;

    const handleGuestJoin = async () => {
        if (!selectedRoom) return; // Must have selected a room

        // Save to cookies for persistence with 1 year expiry
        const options = { maxAge: 60 * 60 * 24 * 365, path: '/' };
        setCookie('display_name', username, options);
        setCookie('avatar_seed', characterSeed.toString(), options);
        if (guestToken) {
            setCookie('guest_token', guestToken, options);
        }

        let startData = {
            name: sanitizeUsername(username),
            avatar: previewUrl,
            isGuest: !isDiscordUser,
            guestToken: guestToken,
            role: session?.user?.role || 'USER',
            discordId: session?.user?.id,
            avatarSeed: characterSeed,
            roomId: selectedRoom.slug,
            roomName: selectedRoom.name,
            ircConfig: {
                useIRC: true,
                host: 'testnet.ergo.chat',
                port: 6697,
                nick: sanitizeUsername(username),
                channel: selectedRoom.ircChannel || `#camrooms-${selectedRoom.slug}`,
                username: sanitizeUsername(username)
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
        handleJoinWithZoom(startData);
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
                <Background zoomLevel={0} />
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

    const headerProps = {
        selectedRoom, setSelectedRoom,
        isDiscordUser,
        showCreateModal, setShowCreateModal,
        status, session,
        showProfileMenu, setShowProfileMenu,
        showProfileModal, setShowProfileModal,
        showStatusInput, setShowStatusInput,
        showSettingsModal, setShowSettingsModal,
        customStatus, setCustomStatus,
        handleDiscordLogin
    };

    // Step 1: Room Selection
    if (!selectedRoom) {
        return (
            <div className="entry-screen-container" style={{
                paddingTop: '72px',
                marginTop: '0',
                minHeight: '100dvh',
                height: 'auto',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingBottom: '80px',
                boxSizing: 'border-box'
            }}>
                <Background zoomLevel={zoomLevel} />

                <AppHeader {...headerProps} />
                <RoomBrowser
                    onSelectRoom={setSelectedRoom}
                    isDiscordUser={isDiscordUser}
                    showCreateModal={showCreateModal}
                    setShowCreateModal={setShowCreateModal}
                    onOpenSettings={() => setShowSettingsModal(true)}
                />
            </div>
        );
    }

    // Step 2: Identity Selection
    return (
        <div className="entry-screen">
            <Background zoomLevel={zoomLevel} />
            <AppHeader {...headerProps} />
            <div className="entry-card backdrop-blur-lg backdrop-brightness-125 bg-white/5 border border-white/10">
                {/* Room Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--accent-surface)', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '13px', color: 'var(--accent-primary)' }}>
                    <Icon icon="fa:comments" width="14" />
                    Joining: <strong>{selectedRoom.name}</strong>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '8px' }}>Choose Identity</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Join the channel</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                    {/* Sprite Preview */}
                    <div style={{ width: '96px', height: '96px', background: 'var(--accent-primary)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px var(--accent-glow)', overflow: 'hidden' }}>
                        <img
                            src={previewUrl}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {!isDiscordUser && (
                            <button className="btn" onClick={handleRandomize} title="Randomize Avatar" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <Icon icon="fa:dice" width="18" /> Randomize
                            </button>
                        )}
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

                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>

                    {/* Main Join Button */}
                    <button
                        className="btn primary"
                        style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center' }}
                        onClick={isDiscordUser ? () => {
                            const customNick = getCookie('custom_nick');
                            const finalName = sanitizeUsername(customNick || session.user.displayName || session.user.globalName || session.user.name);
                            handleJoinWithZoom({
                                name: finalName,
                                avatar: session.user.image || session.user.avatarUrl,
                                image: session.user.image,
                                id: session.user.id,
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
                                roomId: selectedRoom.slug,
                                roomName: selectedRoom.name,
                                ircConfig: {
                                    useIRC: true,
                                    host: 'testnet.ergo.chat',
                                    port: 6697,
                                    nick: finalName,
                                    channel: selectedRoom.ircChannel || `#camrooms-${selectedRoom.slug}`,
                                    username: finalName
                                }
                            });
                        } : handleGuestJoin}
                    >
                        <Icon icon="fa:sign-in" width="16" />
                        Continue{isDiscordUser ? ` as ${session.user.globalName || session.user.name}` : ''}
                    </button>

                    {/* Divider used to be here, but now Guest is top */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>or</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    </div>

                    {/* Discord Login Button - Only for guests */}
                    {status !== 'authenticated' && (
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
                    )}

                    {status === 'authenticated' && (
                        <button
                            className="btn"
                            style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '12px',
                                justifyContent: 'center',
                                background: 'rgba(255, 80, 80, 0.1)',
                                border: '1px solid rgba(255, 80, 80, 0.2)',
                                color: '#ff8080',
                            }}
                            onClick={() => signOut({ callbackUrl: '/' })}
                        >
                            Log Out
                        </button>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Joining {selectedRoom.ircChannel || `#camrooms-${selectedRoom.slug}`} on testnet.ergo.chat
                </div>
            </div>
        </div>
    );
}

// Extracted AppHeader Component
const AppHeader = ({
    selectedRoom, setSelectedRoom,
    isDiscordUser,
    showCreateModal, setShowCreateModal,
    status, session,
    showProfileMenu, setShowProfileMenu,
    showProfileModal, setShowProfileModal,
    showStatusInput, setShowStatusInput,
    showSettingsModal, setShowSettingsModal,
    customStatus, setCustomStatus,
    handleDiscordLogin
}) => (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 100,
        background: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a href="https://sardistic.com" target="_blank" rel="noopener noreferrer">
                <img src="https://www.sardistic.com/wp-content/uploads/2026/02/liquid_transparent.webp" alt="Logo" style={{ height: '50px' }} />
            </a>
            <div style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>
                <span
                    onClick={() => setSelectedRoom(null)}
                    style={{ cursor: 'pointer', color: selectedRoom ? 'rgba(255,255,255,0.7)' : 'white' }}
                >
                    Browser
                </span>
                {selectedRoom && (
                    <>
                        <span style={{ opacity: 0.3, margin: '0 4px' }}>/</span>
                        <span style={{ color: 'white' }}>{selectedRoom.name}</span>
                    </>
                )}
            </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Create Room Button - Only for Discord users */}
            {!selectedRoom && isDiscordUser && (
                <button
                    className="btn primary"
                    onClick={() => setShowCreateModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
                >
                    <Icon icon="fa:plus" width="12" />
                    Create
                </button>
            )}

            {status === 'authenticated' && session?.user ? (
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            padding: '4px 8px 4px 4px', borderRadius: '32px', cursor: 'pointer',
                            color: 'white', fontSize: '13px', transition: 'all 0.2s'
                        }}
                        className="header-profile-btn"
                    >
                        <img src={session.user.image} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                        <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session.user.name}
                        </span>
                        <Icon icon="fa:caret-down" width="10" style={{ opacity: 0.5 }} />
                    </button>

                    {showProfileMenu && (
                        <div className="profile-menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '220px', zIndex: 100 }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>{session.user.globalName || session.user.name}</div>
                                <div style={{ fontSize: '11px', color: '#3ba55d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '8px', height: '8px', background: '#3ba55d', borderRadius: '50%', display: 'inline-block' }}></span>
                                    {customStatus || 'Online'}
                                </div>
                            </div>

                            <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowProfileModal(true); }}>
                                <Icon icon="fa:user" width="16" /> View Profile
                            </button>
                            <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowStatusInput(true); }}>
                                <Icon icon="fa:comment" width="16" /> Set Status
                            </button>
                            <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowSettingsModal(true); }}>
                                <Icon icon="fa:cog" width="16" /> Settings
                            </button>

                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                            <button className="menu-item danger" onClick={() => signOut({ callbackUrl: '/' })}>
                                <Icon icon="fa:sign-out" width="16" /> Disconnect
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    className="btn"
                    onClick={handleDiscordLogin}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', background: '#5865F2', border: 'none', color: 'white' }}
                >
                    <svg width="16" height="16" viewBox="0 0 71 55" fill="currentColor">
                        <path d="M60.1 4.9A58.5 58.5 0 0045.4.5a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.6a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.4.2.2 0 00-.1.1C1.5 18.2-.9 31 .3 43.7a.2.2 0 00.1.1 58.8 58.8 0 0017.7 8.9.2.2 0 00.2 0 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2 0 58.6 58.6 0 0017.7-8.9.2.2 0 00.1-.1c1.4-14.5-2.4-27.1-10-38.3a.2.2 0 00-.1-.1zM23.7 35.8c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.6-6.7 6-6.7c3.3 0 6 3 6 6.7 0 3.7-2.7 6.7-6 6.7z" />
                    </svg>
                    Login
                </button>
            )}
        </div>

        {/* Modals placed here to be available in all views */}
        {showStatusInput && (
            <div className="profile-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="profile-modal" style={{ padding: '20px', width: '300px', background: '#1E1E24', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Set Custom Status</h3>
                    <input
                        type="text"
                        placeholder="What's on your mind?"
                        value={customStatus}
                        onChange={(e) => setCustomStatus(e.target.value)}
                        maxLength={50}
                        autoFocus
                        className="chat-input"
                        style={{ width: '100%', marginBottom: '12px' }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') setShowStatusInput(false);
                            if (e.key === 'Escape') { setCustomStatus(''); setShowStatusInput(false); }
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn" onClick={() => { setCustomStatus(''); setShowStatusInput(false); }}>Clear</button>
                        <button className="btn primary" onClick={() => setShowStatusInput(false)}>Save</button>
                    </div>
                </div>
            </div>
        )
        }

        {/* Settings Modal */}
        {showSettingsModal && (
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                user={session?.user}
                onSaveSuccess={() => {
                    update(); // Refresh NextAuth session
                }}
            />
        )}

        <ProfileModal
            user={session?.user}
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            currentUser={session?.user}
        />
    </div >
);
