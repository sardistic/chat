"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProfileModal from "./ProfileModal";
import CameraReactiveGrid from "./CameraReactiveGrid";
import { useCameraEffects } from "@/hooks/useCameraEffects";

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
    mentionCount = 0,  // How many times this user was mentioned recently
    chatActivity = 0,  // Recent chat message count (0-10+)
    isDiscordUser = false
}) {
    const tileVideoRef = useRef(null);

    // Camera effects hook - only for vibrancy/color analysis
    const { brightness, dominantColor, effectIntensity } = useCameraEffects(
        tileVideoRef,
        isVideoEnabled
    );

    // Update video element
    useEffect(() => {
        if (tileVideoRef.current && stream) {
            tileVideoRef.current.srcObject = stream;
        }
    }, [stream]);

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

    return (
        <div
            className={`tile effect-${effectIntensity} ${borderStyle.animation}`}
            style={{ background }}
            onClick={onClick}
        >
            {/* Ambient diffused glow behind the tile (reflects camera colors) */}
            {isVideoEnabled && (
                <div
                    className="tile-ambient-glow"
                    style={{
                        background: ambientGlowColor,
                        opacity: Math.min(0.6, brightness / 200),
                    }}
                />
            )}

            {/* Smart glow border */}
            <div
                className="tile-glow-border"
                style={{
                    boxShadow: borderStyle.glowSize > 0
                        ? `0 0 ${borderStyle.glowSize}px ${borderStyle.glowColor}`
                        : 'none',
                    border: `${borderStyle.borderWidth}px solid ${borderStyle.borderColor}`,
                }}
            />

            {/* Animated dot grid background (reacts to camera colors) */}
            <CameraReactiveGrid videoRef={tileVideoRef} isActive={isVideoEnabled && !!stream} />

            {/* Video or avatar */}
            {isVideoEnabled && stream ? (
                <video
                    ref={tileVideoRef}
                    autoPlay
                    muted={isLocal || isDeafened}
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

            {/* Name overlay */}
            <div className="overlay">
                <div className="name">
                    <span
                        className="status-dot"
                        style={{ background: isVideoEnabled ? 'var(--status-online)' : 'var(--text-muted)' }}
                    />
                    {user?.name || 'User'} {isLocal && '(You)'}
                    {isDiscordUser && <span style={{ marginLeft: '4px', opacity: 0.7 }}>🔗</span>}
                </div>
                <div className="status-icons">
                    {!isAudioEnabled && <span>🔇</span>}
                    {!isLocal && user?.isDeafened && <span>🙉</span>}
                    {mentionCount > 0 && <span title={`Mentioned ${mentionCount}x`}>💬</span>}
                </div>
            </div>
        </div>
    );
}

export default function VideoGrid({ localStream, peers, localUser, isVideoEnabled, isAudioEnabled, isDeafened }) {
    // Profile modal state
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalPosition, setModalPosition] = useState(null);

    const peerArray = Array.from(peers.entries());

    // Handle tile click to show profile
    const handleTileClick = (e, user) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setSelectedUser(user);
        setModalPosition({
            x: rect.right + 10,
            y: rect.top,
        });
    };

    // Close modal
    const handleCloseModal = () => {
        setSelectedUser(null);
        setModalPosition(null);
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
                />

                {/* Remote Peer Tiles */}
                {peerArray.map(([peerId, peerData]) => {
                    const isRemoteVideoActive = peerData.stream && peerData.user?.isVideoEnabled;
                    const isRemoteMuted = peerData.user?.isAudioEnabled === false;

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
                        />
                    );
                })}
            </div>

            {/* Profile Modal */}
            <ProfileModal
                user={selectedUser}
                isOpen={!!selectedUser}
                onClose={handleCloseModal}
                position={modalPosition}
            />
        </>
    );
}
