"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CameraReactiveGrid from "./CameraReactiveGrid";
import { useCameraEffects } from "@/hooks/useCameraEffects";
import { useSocket } from "@/lib/socket";
import { Icon } from '@iconify/react';

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

// Generate a deterministic color from a username (similar to avatar API)
function getUserColor(name) {
    if (!name) return '#6366F1';

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }

    // Generate HSL color with good saturation and lightness
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

// Create a faded gradient background from a color
function getFadedBackground(color) {
    return `radial-gradient(ellipse at center, ${color}30 0%, ${color}15 40%, #1a1a1a 100%)`;
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

    isDiscordUser = false,
    settings = { volume: 1, isLocallyMuted: false, isVideoHidden: false },
    onUpdateSettings = () => { }
}) {
    const tileVideoRef = useRef(null);
    const [showPicker, setShowPicker] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

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
            // Use the same hash function as color
            let hash = 0;
            const name = user?.name || 'guest';
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
                hash = hash & hash;
            }
            const vibe = VIBES[Math.abs(hash) % VIBES.length];

            animation = `vibe-${vibe}`;

            // Adjust colors based on vibe if not already set by camera
            if (!isVideoEnabled || !dominantColor) {
                if (vibe === 'hype') { borderColor = '#ff00ff'; glowColor = '#00ffff'; }
                if (vibe === 'chill') { borderColor = '#6495ed'; glowColor = '#8a2be2'; }
                if (vibe === 'happy') { borderColor = '#ffd700'; glowColor = '#ffa500'; }
                if (vibe === 'focused') { borderColor = 'rgba(255,255,255,0.5)'; glowColor = 'rgba(255,255,255,0.2)'; }
            }
        }

        return { borderWidth, glowSize, borderColor, glowColor, animation };
    };

    const borderStyle = getBorderStyle();

    const handleReactionClick = (e, emoji) => {
        e.stopPropagation();
        onReaction(emoji);
        setShowPicker(false);
    };

    return (
        <div
            className={`tile effect-${effectIntensity} ${borderStyle.animation}`}
            style={{ background }}
            onClick={onClick}
            onMouseLeave={() => { setShowPicker(false); setShowMenu(false); }}
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
                    boxShadow: borderStyle.glowSize > 0
                        ? `0 0 ${borderStyle.glowSize}px ${borderStyle.glowColor}`
                        : 'none',
                    border: `${borderStyle.borderWidth}px solid ${borderStyle.borderColor}`,
                }}
            />

            {/* Top Right Menu Trigger */}
            <div className={`tile-menu-trigger ${showMenu ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowPicker(false); }}>
                <Icon icon="fa:ellipsis-v" width="8" />
            </div>

            {/* Dropdown Menu - Positioned relative to tile */}
            {showMenu && (
                <div className="tile-menu" onClick={e => e.stopPropagation()}>
                    <div className="menu-section">
                        <div className="menu-label">Local Volume</div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
                            className="volume-slider"
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="menu-divider" />
                    <button className="menu-item" onClick={() => onUpdateSettings({ isLocallyMuted: !isLocallyMuted })}>
                        <Icon icon={isLocallyMuted ? "fa:microphone" : "fa:microphone-slash"} width="12" />
                        {isLocallyMuted ? "Unmute" : "Mute"}
                    </button>
                    <button className="menu-item" onClick={() => onUpdateSettings({ isVideoHidden: !isVideoHidden })}>
                        <Icon icon={isVideoHidden ? "fa:video-camera" : "fa:eye-slash"} width="12" />
                        {isVideoHidden ? "Show Cam" : "Disable Cam"}
                    </button>
                    <button className="menu-item" onClick={(e) => { onClick(e); setShowMenu(false); }}>
                        <Icon icon="fa:user" width="12" />
                        Profile
                    </button>
                </div>
            )}

            <CameraReactiveGrid
                videoRef={tileVideoRef}
                isActive={isVideoEnabled && !!stream}
                reactionTimestamp={latestReactionTime.current}
            />

            {isVideoEnabled && stream && !isVideoHidden ? (
                <video
                    ref={tileVideoRef}
                    autoPlay
                    playsInline
                    className="video"
                    style={{
                        transform: isLocal ? 'scaleX(-1)' : 'none',
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent'
                }}>
                    <img
                        src={user?.avatar || user?.image || `/api/avatar/${user?.name || 'User'}`}
                        alt={user?.name}
                        style={{
                            width: '80px',
                            height: '80px',
                            opacity: isLocal ? 0.9 : 0.7,
                            filter: isLocal ? 'none' : 'grayscale(50%)'
                        }}
                    />
                </div>
            )}

            {/* Name & Controls Overlay */}
            <div className="overlay">
                <div className="name-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <div className="name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                            className="status-dot"
                            style={{ background: isVideoEnabled ? 'var(--status-online)' : 'var(--text-muted)' }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                            {user?.name || 'User'} {isLocal && '(You)'}
                        </span>
                        {isDiscordUser && <span style={{ opacity: 0.7 }}><Icon icon="fa:link" width="12" /></span>}
                    </div>

                    {/* Reaction Button */}
                    {/* Menu logic moved to top-right */}

                    {/* Mini Emoji Picker */}
                    {showPicker && (
                        <div className="emoji-picker-mini" onClick={e => e.stopPropagation()} style={{ right: '30px' }}>
                            {['🔥', '😂', '😮', '👏', '🎉'].map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={(e) => handleReactionClick(e, emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1 }}></div>
            </div>

            <div className="status-icons">
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
    onProfileClick = () => { }
}) {
    const { socket } = useSocket();
    const [incomingReactions, setIncomingReactions] = useState(new Map());

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
            <div className="grid">
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
                />

                {/* Remote Peer Tiles */}
                {peerArray.map(([peerId, peerData]) => {
                    const isRemoteVideoActive = peerData.stream && peerData.user?.isVideoEnabled;
                    const isRemoteMuted = peerData.user?.isAudioEnabled === false;
                    const userId = peerData.user?.id || peerId;

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
                        />
                    );
                })}
            </div>
        </>
    );
}
