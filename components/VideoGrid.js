"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

import { useCameraEffects } from "@/hooks/useCameraEffects";
import { useSocket } from "@/lib/socket";
import { Icon } from '@iconify/react';
import TubeTile from './TubeTile';
import EmojiPicker from './EmojiPicker'; // [NEW]
import { useEmotes } from '@/hooks/useEmotes'; // [NEW]
import { motion, AnimatePresence } from 'framer-motion';
import { triggerDotRipple } from './DotGrid';

// Floating emoji animation component
// Floating emoji/image animation component
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

    const isImage = emoji && (emoji.startsWith('http') || emoji.startsWith('/'));

    return (
        <div className="floating-reaction" style={style}>
            {isImage ? <img src={emoji} alt="reaction" /> : emoji}
        </div>
    );
}

// Collapsed user bar for semi-active users (mobile)
function CollapsedUserBar({ user, lastMessage, onClick, style = {} }) {
    const userColor = user?.name ? getUserColor(user.name) : 'oklch(60% 0.15 250)';

    return (
        <div
            className="collapsed-user-bar backdrop-blur-xl bg-black/40 border-l-[3px] rounded-lg"
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                ...style, // Merge custom styles
                gap: '8px',
                padding: '6px 10px',
                borderColor: userColor, // Dynamic border color in style is fine
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
    let bestLayout = { cols: 1, rows: 1, width: 100, height: 56 };
    if (videoCount === 0) return bestLayout;

    // Minimal padding (economical on mobile) - Must match or exceed CSS padding (12px = 24px total)
    const paddingX = isMobile ? 12 : 32;
    const paddingY = isMobile ? 12 : 32;
    const gap = isMobile ? 4 : 12;

    let maxArea = 0;

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

        // Try width-first fit
        let w1 = maxTileWidth;
        let h1 = Math.floor(w1 / aspectRatio);
        if (h1 > maxTileHeight) {
            h1 = maxTileHeight;
            w1 = Math.floor(h1 * aspectRatio);
        }

        // Try height-first fit
        let h2 = maxTileHeight;
        let w2 = Math.floor(h2 * aspectRatio);
        if (w2 > maxTileWidth) {
            w2 = maxTileWidth;
            h2 = Math.floor(w2 / aspectRatio);
        }

        // Pick the larger area
        const area1 = w1 * h1;
        const area2 = w2 * h2;
        const [w, h] = area1 >= area2 ? [w1, h1] : [w2, h2];
        const area = w * h;

        if (area > maxArea) {
            maxArea = area;
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

    return `radial-gradient(ellipse at center, ${c1} 0%, ${c2} 40%, rgba(5, 5, 5, 0.4) 100%)`;
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
    isMobile = false,
    emotes, // [NEW] Passed from parent
    customBackground = null // [NEW]
}) {
    const tileVideoRef = useRef(null);
    const tileRef = useRef(null); // For position tracking
    const [showPicker, setShowPicker] = useState(false);
    const wasTypingRef = useRef(false); // Track typing state changes

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

    // Trigger ripple from tile center when typing starts
    useEffect(() => {
        if (isTyping && !wasTypingRef.current && tileRef.current) {
            const rect = tileRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const userColor = user?.color || '#ffffff';
            // Subtle typing ripple from tile
            triggerDotRipple('typing', { x: centerX, y: centerY }, userColor, 0.4);
        }
        wasTypingRef.current = isTyping;
    }, [isTyping, user?.color]);

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

    // Background Logic: Use custom image if active (and video hidden or ambient), or fall back to gradient
    // If video is enabled, this background sits BEHIND the video (visible if video has transparency or loading)
    // OR if we want to replace the background entirely when video is off
    const background = customBackground
        ? `url(${customBackground}) center/cover no-repeat`
        : getFadedBackground(userColor);

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
            ref={tileRef}
            className={`tile effect-${effectIntensity} ${borderStyle.animation} relative rounded-xl overflow-hidden backdrop-blur-lg backdrop-brightness-125 bg-white/5 border border-white/10 shadow-lg`}
            style={{
                background, // Keep the gradient, it has transparency
                width: width || '100%',
                height: height || 'auto',
                flex: '0 0 auto'
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
                    background: 'var(--glass-bg-heavy)',
                    backdropFilter: 'var(--glass-blur)',
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
                    <Icon icon={showPicker ? "mdi:close" : "mdi:heart-outline"} width="16" />
                </button>

                {/* Picker Popup */}
                <AnimatePresence>
                    {showPicker && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'absolute',
                                bottom: '100%',
                                right: 0,
                                marginBottom: '8px',
                                zIndex: 100
                            }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                transition={{ duration: 0.15 }}
                            >
                                <EmojiPicker
                                    emotes={emotes}
                                    onSelect={(emoji) => {
                                        onReaction(emoji);
                                        // Optional: keep open or close? Usually close for quick reaction
                                        setShowPicker(false);
                                    }}
                                    onClose={() => setShowPicker(false)}
                                    style={{
                                        width: '280px',
                                        height: '300px'
                                    }}
                                />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <div className="status-icons" style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                display: 'flex',
                gap: '8px',
                zIndex: 40, // Top most
                background: 'var(--glass-bg-heavy)',
                backdropFilter: 'var(--glass-blur)',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {!isAudioEnabled && <span><Icon icon="fa:microphone-slash" width="14" /></span>}
                {!isLocal && user?.isDeafened && <span><Icon icon="fontelico:headphones" width="14" /></span>}
                {mentionCount > 0 && <span title={`Mentioned ${mentionCount}x`}><Icon icon="fa:comment" width="14" /></span>}
            </div>
        </div >

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
    const { emotes } = useEmotes(); // [NEW] Load global emotes 
    const [incomingReactions, setIncomingReactions] = useState(new Map());

    // Background Selection State
    const [activeBackground, setActiveBackground] = useState('none');

    const BACKGROUNDS = {
        cyberpunk: { name: 'Cyberpunk', url: '/backgrounds/cyberpunk.png' },
        forest: { name: 'Cozy Forest', url: '/backgrounds/forest.png' },
        space: { name: 'Deep Space', url: '/backgrounds/space.png' },
        desert: { name: 'Desert Sunset', url: '/backgrounds/desert.png' }
    };

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

    // Deduplicate peers to prevent "lingering ghosts"
    // We group by username, preferring the one with a stream or latest update
    const uniquePeerArray = useMemo(() => {
        if (!peers) return [];
        return Array.from(peers.entries()).reduce((acc, [peerId, peerData]) => {
            const username = peerData.user?.name;
            if (!username) return acc;

            const existingIndex = acc.findIndex(([_, p]) => p.user?.name === username);
            if (existingIndex !== -1) {
                const existing = acc[existingIndex];
                // If new one has stream and old one doesn't, replace
                if (peerData.stream && !existing[1].stream) {
                    acc[existingIndex] = [peerId, peerData];
                }
            } else {
                acc.push([peerId, peerData]);
            }
            return acc;
        }, []);
    }, [peers]);

    // Use filtered count for layout
    const renderTubeInGrid = tubeState && !isMobile;
    const totalTiles = 1 + uniquePeerArray.length + (renderTubeInGrid ? 1 : 0);

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

    const peerArray = uniquePeerArray;

    // Handle tile click to show profile
    const handleTileClick = (e, user) => {
        if (e.target.closest('.reaction-control')) return;
        onProfileClick(user, e);
    };

    return (
        <>
            {/* Mobile: Render Tube "Line" outside grid */}
            {isMobile && tubeState && (
                <div style={{ padding: '0 8px 8px 8px' }}>
                    <TubeTile
                        tubeState={tubeState}
                        receivedAt={receivedAt}
                        isOwner={isTubeOwner}
                        settings={{ volume: 0.5, isLocallyMuted: true, isVideoHidden: false }}
                        onSync={(update) => {
                            if (update.type === 'play') onUpdateTubeState({ isPlaying: true, timestamp: update.playedSeconds });
                            if (update.type === 'pause') onUpdateTubeState({ isPlaying: false, timestamp: update.playedSeconds });
                            if (update.type === 'progress') onUpdateTubeState({ timestamp: update.playedSeconds });
                            if (update.type === 'ended') onUpdateTubeState({ type: 'ended', isPlaying: false, timestamp: 0 });
                        }}
                        onMuteChange={onMuteChange}
                        onChangeVideo={(url) => {
                            if (!url) { onUpdateTubeState({ videoId: null, isPlaying: false, timestamp: 0 }); return; }
                            let videoId = url;
                            if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
                            else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
                            onUpdateTubeState({ videoId, isPlaying: true, timestamp: 0 });
                        }}
                        width="100%"
                        height="auto"
                        compact={true}
                    />
                </div>
            )}

            <div className="grid" ref={gridRef} style={{ ...style, overflow: 'hidden' }}>
                {/* Tube Tile (Desktop/Grid Mode) */}
                {renderTubeInGrid && (
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
                    emotes={emotes} // Pass emotes
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
                    customBackground={activeBackground !== 'none' ? BACKGROUNDS[activeBackground].url : null}
                />

                {/* Background Selector UI */}
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    alignItems: 'flex-start'
                }}>
                    <div className="glass-panel" style={{
                        padding: '8px',
                        borderRadius: '12px',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        gap: '8px'
                    }}>
                        <button
                            onClick={() => setActiveBackground('none')}
                            style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                border: activeBackground === 'none' ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                                background: 'transparent',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title="None"
                        >
                            <Icon icon="mdi:close" />
                        </button>
                        {Object.entries(BACKGROUNDS).map(([key, bg]) => (
                            <button
                                key={key}
                                onClick={() => setActiveBackground(key)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    border: activeBackground === key ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.2)',
                                    background: `url(${bg.url}) center/cover`,
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                }}
                                title={bg.name}
                            />
                        ))}
                    </div>
                </div>

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
