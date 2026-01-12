"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import { useCameraEffects } from "@/hooks/useCameraEffects";
import { useSocket } from "@/lib/socket";
import { Icon } from '@iconify/react';
import TubeTile from './TubeTile';

// Floating emoji animation component
function FloatingReaction({ emoji, onComplete }) {
    useEffect(() => {
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    // Randomize path slightly
    const [style] = useState(() => ({
        left: `${50 + (Math.random() * 40 - 20)}%`, // Center +/- 20%
        animationDuration: `${1.5 + Math.random()}s`,
    }));

    return (
        <div className="floating-reaction" style={style}>
            {emoji}
        </div>
    );
}

// Collapsed user bar for semi-active users (mobile)
function CollapsedUserBar({ user, lastMessage, onClick }) {
    const userColor = user?.name ? getUserColor(user.name) : 'oklch(60% 0.15 250)';

    return (
        <div
            className="collapsed-user-bar"
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                borderRadius: '8px',
                borderLeft: `3px solid ${userColor}`,
                cursor: 'pointer',
                marginBottom: '4px',
                width: '100%',
            }}
        >
            {/* Avatar */}
            <div
                style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${userColor}, ${getSecondaryColor(userColor)})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    flexShrink: 0,
                    overflow: 'hidden',
                }}
            >
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    user?.name?.charAt(0).toUpperCase()
                )}
            </div>

            {/* Name + Last Message */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>
                    {user?.name || 'Unknown'}
                </div>
                {lastMessage && (
                    <div style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.5)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {lastMessage}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to calculate optimal layout
function calculateLayout(containerWidth, containerHeight, videoCount, isMobile, aspectRatio = 16 / 9) {
    let bestLayout = { cols: 1, rows: 1, width: 320, height: 180 };
    if (videoCount === 0) return bestLayout;

    // Deduct padding/gap (minimal on mobile for max space)
    const paddingX = isMobile ? 2 : 48;
    const paddingY = isMobile ? 2 : 48;
    const gap = isMobile ? 2 : 12;

    // On mobile: fill space, use columns as needed to fit all tiles
    if (isMobile) {
        let mobileBest = { cols: 1, rows: videoCount, width: 100, height: 50 };

        // Try up to 3 columns to find best fit
        for (let cols = 1; cols <= Math.min(videoCount, 3); cols++) {
            const rows = Math.ceil(videoCount / cols);
            const hGapTotal = Math.max(0, cols - 1) * gap;
            const vGapTotal = Math.max(0, rows - 1) * gap;

            const availableWidth = containerWidth - hGapTotal - paddingX;
            const availableHeight = containerHeight - vGapTotal - paddingY;

            const w = Math.floor(availableWidth / cols);
            const h = Math.floor(availableHeight / rows);

            // Only accept if tiles have reasonable minimum size
            if (h >= 80 && w >= 100) {
                // Prefer layout with more tiles visible (smaller tiles but more fit)
                const totalArea = w * h * videoCount;
                const bestArea = mobileBest.width * mobileBest.height * videoCount;
                if (totalArea > bestArea || mobileBest.height < 80) {
                    mobileBest = { cols, rows, width: w, height: h };
                }
            }
        }
        return mobileBest;
    }

    // Desktop: use aspect ratio optimization
    for (let cols = 1; cols <= videoCount; cols++) {
        const rows = Math.ceil(videoCount / cols);

        // Available space for tiles excluding gaps
        const hGapTotal = Math.max(0, cols - 1) * gap;
        const vGapTotal = Math.max(0, rows - 1) * gap;

        const availableWidth = containerWidth - hGapTotal - paddingX;
        const availableHeight = containerHeight - vGapTotal - paddingY;

        if (availableWidth <= 0 || availableHeight <= 0) continue;

        const maxTileWidth = Math.floor(availableWidth / cols);
        const maxTileHeight = Math.floor(availableHeight / rows);

        // Fit based on aspect ratio
        let w = maxTileWidth;
        let h = w / aspectRatio;

        if (h > maxTileHeight) {
            h = maxTileHeight;
            w = h * aspectRatio;
        }

        // Ensure integer values
        w = Math.floor(w);
        h = Math.floor(h);

        // Maximizing area
        if (w > bestLayout.width || cols === 1) {
            bestLayout = { cols, rows, width: w, height: h };
        }
    }
    return bestLayout;
}


// Generate a deterministic color from a username using OKLCH for uniform brightness
function getUserColor(name) {
    if (!name) return 'oklch(60% 0.15 250)';

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Curated spectrum using OKLCH (Lightness 68%, Chroma 0.16)
    const hues = [25, 65, 125, 185, 245, 305, 10, 150, 210, 280];
    const hue = hues[Math.abs(hash) % hues.length];
    const fineHue = (hue + (Math.abs(hash) % 20) - 10 + 360) % 360;

    return `oklch(68% 0.16 ${fineHue})`;
}

// Get complementary/analogous color for gradients
function getSecondaryColor(oklchColor, shift = 40) {
    const match = oklchColor.match(/oklch\((\d+%) ([\d.]+) ([\d.]+)\)/);
    if (!match) return oklchColor;
    const [_, l, c, h] = match;
    const newHue = (parseFloat(h) + shift + 360) % 360;
    return `oklch(${l} ${c} ${newHue})`;
}

// Helper to inject alpha into OKLCH or hex
function colorWithAlpha(color, alpha) {
    if (color.startsWith('oklch')) {
        return color.replace(')', ` / ${alpha})`);
    }
    // Handle hex
    if (color.startsWith('#')) {
        const a = Math.floor(alpha * 255).toString(16).padStart(2, '0');
        return color + a;
    }
    return color;
}

// Create a faded gradient background from a color
function getFadedBackground(color) {
    const secondary = getSecondaryColor(color, 40);
    // Darken significantly for background
    const darkColor = color.replace(/oklch\(\d+%/, 'oklch(15%');
    const darkSecondary = secondary.replace(/oklch\(\d+%/, 'oklch(10%');

    const c1 = colorWithAlpha(darkColor, 0.4);
    const c2 = colorWithAlpha(darkSecondary, 0.2);

    return `radial-gradient(ellipse at center, ${c1} 0%, ${c2} 40%, #050505 100%)`;
}

// Individual video tile with smart effects
function VideoTile({
    stream,
    user,
    isLocal,
    isVideoEnabled,
    isAudioEnabled,
    isDeafened,
    onClick,
    onReaction,
    incomingReactions = [],
    mentionCount = 0,
    chatActivity = 0,
    isTyping = false,
    isDiscordUser = false,
    settings = { volume: 1, isLocallyMuted: false, isVideoHidden: false },
    onUpdateSettings = () => { },
    width,
    height,
    isMusicPlaying = false,
    isMobile = false
}) {
    const tileVideoRef = useRef(null);
    const [showPicker, setShowPicker] = useState(false);

    // Destructure settings
    const { volume, isLocallyMuted, isVideoHidden } = settings;

    // Internal state for reactions to render (cleans itself up)
    const [activeReactions, setActiveReactions] = useState([]);

    // Track latest reaction for grid effect
    const latestReactionTime = useRef(0);

    // Sync incoming reactions to local state for animation
    useEffect(() => {
        if (incomingReactions.length > 0) {
            // Add new reactions to active list
            const newReactions = incomingReactions.map(r => ({
                id: r.id || Date.now() + Math.random(),
                emoji: r.emoji
            }));
            setActiveReactions(prev => [...prev, ...newReactions]);
            latestReactionTime.current = Date.now();
        }
    }, [incomingReactions]);

    // Cleanup helper
    const removeReaction = useCallback((id) => {
        setActiveReactions(prev => prev.filter(r => r.id !== id));
    }, []);

    // Camera effects hook - only for vibrancy/color analysis
    const { brightness, dominantColor, effectIntensity } = useCameraEffects(
        tileVideoRef,
        isVideoEnabled
    );

    // Update video element
    useEffect(() => {
        if (tileVideoRef.current) {
            if (stream) tileVideoRef.current.srcObject = stream;
            tileVideoRef.current.volume = volume;
            tileVideoRef.current.muted = isLocal || isDeafened || isLocallyMuted;
        }
    }, [stream, volume, isLocal, isDeafened, isLocallyMuted]);

    const userColor = getUserColor(user?.name);
    const background = getFadedBackground(userColor);

    // Compute ambient glow color from dominant color (for diffused background reflection)
    const ambientGlowColor = isVideoEnabled && dominantColor
        ? `rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b})`
        : userColor;

    // Calculate smart border properties based on multiple signals
    const getBorderStyle = () => {
        // Base border from camera vibrancy
        let borderWidth = 2;
        let glowSize = 0;
        let borderColor = 'rgba(255, 255, 255, 0.1)';
        let glowColor = 'transparent';
        let animation = '';

        // 1. Camera vibrancy (when broadcasting)
        if (isVideoEnabled && brightness) {
            const vibrancy = brightness / 255;
            borderWidth = 2 + Math.floor(vibrancy * 2); // 2-4px
            glowSize = 8 + Math.floor(vibrancy * 24); // 8-32px

            if (dominantColor) {
                const { r, g, b } = dominantColor;
                // Boost saturation
                const boost = 1.4;
                const br = Math.min(255, r * boost);
                const bg = Math.min(255, g * boost);
                const bb = Math.min(255, b * boost);
                borderColor = `rgba(${br}, ${bg}, ${bb}, 0.7)`;
                glowColor = `rgba(${br}, ${bg}, ${bb}, 0.5)`;
            }
        }

        // 2. Mentions boost (someone said their name - makes border glow gold briefly)
        if (mentionCount > 0) {
            glowSize = Math.max(glowSize, 24 + mentionCount * 8);
            glowColor = 'rgba(255, 215, 0, 0.6)'; // Gold
            borderColor = '#FFD700';
            animation = 'mention-pulse';
        }

        // 3. Chat activity (frequent chatters get a subtle pulsing border)
        if (chatActivity >= 5 && !mentionCount) {
            animation = 'activity-pulse';
            if (!isVideoEnabled) {
                borderColor = 'rgba(99, 102, 241, 0.6)'; // Indigo for active chatters
                glowSize = 12;
                glowColor = 'rgba(99, 102, 241, 0.3)';
            }
        }

        // 5. Vibe/Mood Animation (User-specific personality)
        // If no other strong signal is active, fall back to the user's inherent "vibe"
        if (!mentionCount && chatActivity < 5 && !animation) {
            // Determine vibe from username deterministically
            const VIBES = ['hype', 'chill', 'happy', 'focused'];
            let hash = 0;
            const name = user?.name || 'guest';
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const vibe = VIBES[Math.abs(hash) % VIBES.length];

            animation = `vibe-${vibe}`;

            if (!isVideoEnabled || !dominantColor) {
                const colorB = getSecondaryColor(userColor, 60);
                borderColor = `linear-gradient(135deg, ${userColor}, ${colorB})`;
                glowColor = userColor;

                if (vibe === 'hype') { glowSize = 15; animation = 'hype-float'; }
                if (vibe === 'chill') { glowSize = 8; opacity: 0.6; }
            }
        }

        return { borderWidth, glowSize, borderColor, glowColor, animation };
    };

    const borderStyle = getBorderStyle();

    return (
        <div
            className={`tile effect-${effectIntensity} ${borderStyle.animation}`}
            style={{
                background,
                width: width || '100%',
                height: height || 'auto',
                flex: '0 0 auto' // Ensure it respects size in flex container
            }}
            onClick={onClick}
            onMouseLeave={() => { setShowPicker(false); }}
        >
            {/* Reaction Overlay */}
            <div className="reaction-layer">
                {activeReactions.map(r => (
                    <FloatingReaction
                        key={r.id}
                        emoji={r.emoji}
                        onComplete={() => removeReaction(r.id)}
                    />
                ))}
            </div>

            {isVideoEnabled && (
                <div
                    className="tile-ambient-glow"
                    style={{
                        background: ambientGlowColor,
                        opacity: Math.min(0.6, brightness / 200),
                    }}
                />
            )}

            <div
                className="tile-glow-border"
                style={{
                    zIndex: 20, // High z-index to stay above video
                    boxShadow: borderStyle.glowSize > 0
                        ? `0 0 ${borderStyle.glowSize}px ${colorWithAlpha(borderStyle.glowColor, 0.4)}`
                        : 'none',
                    // Use border-image for clean gradient borders that don't cover content
                    border: `${borderStyle.borderWidth}px solid transparent`,
                    borderImageSource: borderStyle.borderColor.includes('gradient')
                        ? borderStyle.borderColor
                        : 'none',
                    borderImageSlice: 1,
                    // If not gradient, fall back to solid border
                    borderColor: borderStyle.borderColor.includes('gradient')
                        ? 'transparent'
                        : borderStyle.borderColor,
                    background: 'transparent',
                    pointerEvents: 'none'
                }}
            />



            {isVideoEnabled && stream && !isVideoHidden ? (
                <video
                    ref={tileVideoRef}
                    autoPlay
                    playsInline
                    className="video"
                    style={{
                        transform: isLocal ? 'scaleX(-1)' : 'none',
                        zIndex: 2,
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    zIndex: 2,
                    position: 'relative'
                }}>
                    <img
                        src={(() => {
                            const base = user?.avatar || user?.image || `/api/avatar/${user?.name || 'User'}`;
                            // Only animate if it's our internal avatar API
                            if (isTyping && base.includes('/api/avatar')) {
                                const hasQuery = base.includes('?');
                                return `${base}${hasQuery ? '&' : '?'}expr=typing`;
                            }
                            return base;
                        })()}
                        alt={user?.name}
                        className=""
                        style={{
                            width: '80px',
                            height: '80px',
                            opacity: isLocal ? 0.9 : 0.7,
                            filter: isLocal ? 'none' : 'grayscale(50%)'
                        }}
                    />
                </div>
            )}

            {/* Name & Controls Overlay - Tighter on mobile */}
            <div className="overlay" style={{
                pointerEvents: 'auto',
                zIndex: 30, // Even higher than border
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                padding: isMobile ? '6px 10px' : '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                height: isMobile ? '36px' : '50px',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0
            }} onClick={(e) => e.stopPropagation()}>
                <div className="name-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <div className="name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                            className="status-dot"
                            style={{ background: isVideoEnabled ? 'var(--status-online)' : 'var(--text-muted)' }}
                        />
                        <span>
                            {user?.name || 'User'} {isLocal && '(You)'}
                        </span>
                        {isDiscordUser && <span style={{ opacity: 0.7 }}><Icon icon="fa:link" width="12" /></span>}
                    </div>
                </div>

                <div style={{ flex: 1 }}></div>
            </div>

            {/* Reaction Button - Bottom Right */}
            <div
                className="reaction-control"
                style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    zIndex: 35,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: '14px',
                    padding: '4px 8px',
                    gap: '2px'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="reaction-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowPicker(!showPicker);
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px',
                        lineHeight: 1
                    }}
                    title="React"
                >
                    {showPicker ? '✕' : '❤️'}
                </button>
                {showPicker && ['❤️', '🔥', '😂', '😮', '👏', '🎉'].map(emoji => (
                    <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); onReaction(emoji); setShowPicker(false); }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px',
                            lineHeight: 1
                        }}
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            <div className="status-icons" style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                display: 'flex',
                gap: '8px',
                zIndex: 40, // Top most
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {!isAudioEnabled && <span><Icon icon="fa:microphone-slash" width="14" /></span>}
                {!isLocal && user?.isDeafened && <span><Icon icon="fontelico:headphones" width="14" /></span>}
                {mentionCount > 0 && <span title={`Mentioned ${mentionCount}x`}><Icon icon="fa:comment" width="14" /></span>}
            </div>
        </div>

    );
}

export default function VideoGrid({
    localStream,
    peers,
    localUser,
    isVideoEnabled,
    isAudioEnabled,
    isDeafened,
    roomId,
    peerSettings = {},
    onUpdatePeerSettings = () => { },
    onProfileClick = () => { },
    typingUsers = [],

    // New props from chat
    mentionCounts = {},
    chatReactions = [],

    // Tube props
    tubeState = null,
    receivedAt = 0,
    onUpdateTubeState = () => { },
    isTubeOwner = false,
    blockedIds = new Set(), // Passed from useChat
    onMuteChange, // Passed from page.js
    isMobile = false,
    style = {},

    // Activity-based mobile props
    displayStates = {},
    chatBubbles = {}
}) {
    const { socket } = useSocket();
    const [incomingReactions, setIncomingReactions] = useState(new Map());

    // Process chat-driven reactions
    useEffect(() => {
        if (chatReactions.length > 0) {
            // Get the latest reaction
            const latest = chatReactions[chatReactions.length - 1];

            // Helper to match name to ID
            const findUserId = (name) => {
                if (name === localUser?.name) return localUser.id || socket?.id;
                for (const [pid, pdata] of peers) {
                    if (pdata.user?.name === name) return pdata.user.id || pid;
                }
                return null;
            };

            const targetId = findUserId(latest.sender);

            if (targetId) {
                setIncomingReactions(prev => {
                    const newMap = new Map(prev);
                    const current = newMap.get(targetId) || [];
                    // Avoid duplicates if same ID processed
                    if (current.some(r => r.id === latest.id)) return prev;

                    const updated = [...current, { id: latest.id, emoji: latest.emoji }].slice(-5);
                    newMap.set(targetId, updated);
                    return newMap;
                });

                // Cleanup after 3s
                setTimeout(() => {
                    setIncomingReactions(prev => {
                        const newMap = new Map(prev);
                        const current = newMap.get(targetId) || [];
                        if (current.length > 0) {
                            // allow cleanup of specific id
                            const filtered = current.filter(r => r.id !== latest.id);
                            newMap.set(targetId, filtered);
                        }
                        return newMap;
                    });
                }, 3000);
            }
        }
    }, [chatReactions, localUser, peers, socket]);

    // Layout State
    const gridRef = useRef(null);
    const [layout, setLayout] = useState({ width: 320, height: 180 });
    const totalTiles = 1 + (peers ? peers.size : 0) + (tubeState ? 1 : 0);

    // Resize Observer for Dynamic Layout
    useEffect(() => {
        const updateLayout = () => {
            if (gridRef.current) {
                const { clientWidth, clientHeight } = gridRef.current;
                const { width, height } = calculateLayout(clientWidth, clientHeight, totalTiles, isMobile);
                setLayout({ width, height });
            }
        };

        // Initial calc
        updateLayout();

        // Observer
        const observer = new ResizeObserver(updateLayout);
        if (gridRef.current) observer.observe(gridRef.current);

        window.addEventListener('resize', updateLayout);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateLayout);
        };
    }, [totalTiles, isMobile]);

    // Listen for reactions
    useEffect(() => {
        if (!socket) return;

        const handleReaction = ({ senderId, targetId, emoji, timestamp }) => {
            if (targetId) {
                setIncomingReactions(prev => {
                    const newMap = new Map(prev);
                    const current = newMap.get(targetId) || [];
                    // Keep last 5 reactions to avoid overflow
                    const updated = [...current, { id: timestamp + Math.random(), emoji }].slice(-5);
                    newMap.set(targetId, updated);
                    return newMap;
                });

                // Cleanup after animation (3s)
                setTimeout(() => {
                    setIncomingReactions(prev => {
                        const newMap = new Map(prev);
                        const current = newMap.get(targetId) || [];
                        if (current.length > 0) {
                            newMap.set(targetId, current.slice(1));
                        }
                        return newMap;
                    });
                }, 3000);
            }
        };

        socket.on('reaction', handleReaction);
        return () => socket.off('reaction', handleReaction);
    }, [socket]);

    const sendReaction = (targetId, emoji) => {
        if (socket && roomId) {
            socket.emit('reaction', { roomId, targetId, emoji });

            // Optimistic update for self
            setIncomingReactions(prev => {
                const newMap = new Map(prev);
                const current = newMap.get(targetId) || [];
                const updated = [...current, { id: Date.now(), emoji }].slice(-5);
                newMap.set(targetId, updated);
                return newMap;
            });
        }
    };

    const peerArray = Array.from(peers.entries());

    // Handle tile click to show profile
    const handleTileClick = (e, user) => {
        if (e.target.closest('.reaction-control')) return;
        onProfileClick(user, e);
    };

    return (
        <>
            <div className="grid" ref={gridRef} style={{ ...style, overflow: 'hidden' }}>
                {/* Tube Tile */}
                {tubeState && (
                    <TubeTile
                        tubeState={tubeState}
                        receivedAt={receivedAt}
                        isOwner={isTubeOwner}
                        settings={{ volume: 0.5, isLocallyMuted: true, isVideoHidden: false }} // Tube settings default to muted for autoplay policy
                        onSync={(update) => {
                            if (update.type === 'play') onUpdateTubeState({ isPlaying: true, timestamp: update.playedSeconds });
                            if (update.type === 'pause') onUpdateTubeState({ isPlaying: false, timestamp: update.playedSeconds });
                            if (update.type === 'progress') onUpdateTubeState({ timestamp: update.playedSeconds });
                            if (update.type === 'ended') onUpdateTubeState({ type: 'ended', isPlaying: false, timestamp: 0 });
                        }}
                        onMuteChange={onMuteChange}
                        onChangeVideo={(url) => {
                            if (!url) {
                                // Eject / Stop
                                onUpdateTubeState({ videoId: null, isPlaying: false, timestamp: 0 });
                                return;
                            }

                            // Extract videoId BEFORE sending to ensure consistency with server
                            let videoId = url;
                            if (url.includes('v=')) {
                                videoId = url.split('v=')[1].split('&')[0];
                            } else if (url.includes('youtu.be/')) {
                                videoId = url.split('youtu.be/')[1].split('?')[0];
                            }
                            onUpdateTubeState({ videoId, isPlaying: true, timestamp: 0 });
                        }}
                        width={layout.width}
                        height={layout.height}
                    />
                )}

                {/* Local User Tile */}
                <VideoTile
                    stream={localStream}
                    user={localUser}
                    isLocal={true}
                    isVideoEnabled={isVideoEnabled}
                    isAudioEnabled={isAudioEnabled}
                    isDeafened={true}
                    isDiscordUser={!!localUser?.discordId}
                    onClick={(e) => handleTileClick(e, localUser)}
                    onReaction={(emoji) => sendReaction(localUser?.id || socket?.id, emoji)}
                    incomingReactions={incomingReactions.get(localUser?.id || socket?.id) || []}
                    // Local user doesn't really need settings, but we pass defaults
                    settings={{ volume: 0, isLocallyMuted: true, isVideoHidden: false }}
                    isTyping={typingUsers.includes(localUser?.name)}
                    mentionCount={mentionCounts[localUser?.name] || 0}
                    width={layout.width}
                    height={layout.height}
                    isMusicPlaying={tubeState?.isPlaying}
                    isMobile={isMobile}
                />

                {/* Remote Peer Tiles */}
                {peerArray.map(([peerId, peerData]) => {
                    const userId = peerData.user?.id || peerId;
                    const username = peerData.user?.name;

                    // Filter Blocked Users
                    if (blockedIds.has(userId)) return null;

                    // Activity-based filtering (mobile only)
                    if (isMobile && username) {
                        const displayState = displayStates[username] || 'active';

                        // Inactive users don't render in grid (they appear in header avatars)
                        if (displayState === 'inactive') return null;

                        // Semi-active users render as collapsed bars
                        if (displayState === 'semi-active') {
                            return (
                                <CollapsedUserBar
                                    key={peerId}
                                    user={peerData.user}
                                    lastMessage={chatBubbles[username]}
                                    onClick={(e) => handleTileClick(e, peerData.user)}
                                />
                            );
                        }
                    }

                    const isRemoteVideoActive = peerData.stream && peerData.user?.isVideoEnabled;
                    const isRemoteMuted = peerData.user?.isAudioEnabled === false;

                    // Get settings for this peer or default
                    const mySettings = peerSettings[userId] || { volume: 1, isLocallyMuted: false, isVideoHidden: false };

                    return (
                        <VideoTile
                            key={peerId}
                            stream={peerData.stream}
                            user={peerData.user}
                            isLocal={false}
                            isVideoEnabled={isRemoteVideoActive}
                            isAudioEnabled={!isRemoteMuted}
                            isDeafened={isDeafened}
                            isDiscordUser={!!peerData.user?.discordId}
                            onClick={(e) => handleTileClick(e, peerData.user)}
                            onReaction={(emoji) => sendReaction(userId, emoji)}
                            incomingReactions={incomingReactions.get(userId) || []}
                            settings={mySettings}
                            onUpdateSettings={(newVals) => onUpdatePeerSettings(userId, newVals)}
                            isTyping={typingUsers.includes(peerData.user?.name)}
                            mentionCount={mentionCounts[peerData.user?.name] || 0}
                            width={layout.width}
                            height={layout.height}
                            isMusicPlaying={tubeState?.isPlaying}
                            isMobile={isMobile}
                        />
                    );
                })}
            </div>
        </>
    );
}
