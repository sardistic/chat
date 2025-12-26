"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProfileModal from "./ProfileModal";
import { useCameraEffects, SparkleOverlay } from "@/hooks/useCameraEffects";

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

// Individual video tile with effects
function VideoTile({ videoRef, stream, user, isLocal, isVideoEnabled, isAudioEnabled, isDeafened, onClick }) {
    const tileVideoRef = useRef(null);
    const [effectsEnabled, setEffectsEnabled] = useState(true);

    // Camera effects hook
    const { brightness, dominantColor, effectIntensity, effectStyles } = useCameraEffects(
        tileVideoRef,
        isVideoEnabled && effectsEnabled
    );

    // Update video element
    useEffect(() => {
        if (tileVideoRef.current && stream) {
            tileVideoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Sync with parent ref if provided
    useEffect(() => {
        if (videoRef) {
            videoRef.current = tileVideoRef.current;
        }
    }, [videoRef]);

    const userColor = getUserColor(user?.name);
    const background = getFadedBackground(userColor);

    // Compute ambient glow color from dominant color (for diffused background reflection)
    const ambientGlowColor = isVideoEnabled && dominantColor
        ? `rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b})`
        : userColor;

    return (
        <div
            className={`tile effect-${effectIntensity}`}
            style={{ background }}
            onClick={onClick}
        >
            {/* Ambient diffused glow behind the tile (reflects camera colors) */}
            {isVideoEnabled && (
                <div
                    className="tile-ambient-glow"
                    style={{
                        background: ambientGlowColor,
                        opacity: Math.min(0.5, brightness / 300),
                    }}
                />
            )}

            {/* Glow border */}
            {isVideoEnabled && (
                <div
                    className={`tile-glow-border ${effectStyles.pulseAnimation ? 'pulse' : ''} ${effectStyles.rainbow ? 'rainbow' : ''}`}
                    style={{
                        boxShadow: `0 0 ${effectStyles.glowSize}px ${effectStyles.glowColor}, inset 0 0 0 2px ${effectStyles.borderColor}`,
                    }}
                />
            )}

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

            {/* Sparkle overlay for broadcasting tiles */}
            {isVideoEnabled && effectStyles.sparkleCount > 0 && (
                <SparkleOverlay
                    count={effectStyles.sparkleCount}
                    speed={effectStyles.sparkleSpeed}
                    active={brightness > 80}
                />
            )}

            {/* Name overlay */}
            <div className="overlay">
                <div className="name">
                    <span
                        className="status-dot"
                        style={{ background: isVideoEnabled ? 'var(--status-online)' : 'var(--text-muted)' }}
                    />
                    {user?.name || 'User'} {isLocal && '(You)'}
                </div>
                <div className="status-icons">
                    {!isAudioEnabled && <span>🔇</span>}
                    {!isLocal && user?.isDeafened && <span>🙉</span>}
                </div>
            </div>
        </div>
    );
}

export default function VideoGrid({ localStream, peers, localUser, isVideoEnabled, isAudioEnabled, isDeafened }) {
    const localVideoRef = useRef(null);
    const peerVideoRefs = useRef(new Map());

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
                    videoRef={localVideoRef}
                    stream={localStream}
                    user={localUser}
                    isLocal={true}
                    isVideoEnabled={isVideoEnabled}
                    isAudioEnabled={isAudioEnabled}
                    isDeafened={true} // Always mute own audio
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
