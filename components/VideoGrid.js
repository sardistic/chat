"use client";

import { useEffect, useRef } from "react";

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

export default function VideoGrid({ localStream, peers, localUser, isVideoEnabled, isAudioEnabled, isDeafened }) {
    const localVideoRef = useRef(null);
    const peerVideoRefs = useRef(new Map());

    // Update local video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Update peer video elements
    useEffect(() => {
        peers.forEach((peerData, peerId) => {
            const videoElement = peerVideoRefs.current.get(peerId);
            if (videoElement && peerData.stream) {
                videoElement.srcObject = peerData.stream;
            }
        });
    }, [peers]);

    const peerArray = Array.from(peers.entries());

    // Get local user's background color
    const localColor = getUserColor(localUser?.name);
    const localBackground = getFadedBackground(localColor);

    return (
        <div className="grid">
            {/* Local User Tile */}
            <div className="tile" style={{ background: localBackground }}>
                {isVideoEnabled && localStream ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="video"
                        style={{
                            transform: 'scaleX(-1)' // Mirror local video
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
                            src={localUser?.avatar || `/api/avatar/${localUser?.name}`}
                            alt={localUser?.name}
                            style={{ width: '80px', height: '80px', opacity: 0.9 }}
                        />
                    </div>
                )}

                <div className="overlay">
                    <div className="name">
                        <span className="status-dot" style={{ background: 'var(--status-online)' }}></span>
                        {localUser?.name || 'Local'} (You)
                    </div>
                    <div className="status-icons">
                        {!isAudioEnabled && <span>🔇</span>}
                    </div>
                </div>
            </div>

            {/* Remote Peer Tiles */}
            {peerArray.map(([peerId, peerData]) => {
                const isRemoteVideoActive = peerData.stream && peerData.user?.isVideoEnabled;
                const isRemoteMuted = peerData.user?.isAudioEnabled === false;

                // Get remote user's background color
                const remoteColor = getUserColor(peerData.user?.name);
                const remoteBackground = getFadedBackground(remoteColor);

                return (
                    <div key={peerId} className="tile" style={{ background: remoteBackground }}>
                        {isRemoteVideoActive ? (
                            <video
                                ref={(el) => {
                                    if (el) {
                                        peerVideoRefs.current.set(peerId, el);
                                        if (peerData.stream) el.srcObject = peerData.stream;
                                    } else {
                                        peerVideoRefs.current.delete(peerId);
                                    }
                                }}
                                autoPlay
                                playsInline
                                muted={isDeafened}
                                className="video"
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
                                    src={peerData.user?.avatar || `/api/avatar/${peerData.user?.name || 'User'}`}
                                    alt={peerData.user?.name}
                                    style={{ width: '80px', height: '80px', opacity: 0.7, filter: 'grayscale(50%)' }}
                                />
                            </div>
                        )}

                        <div className="overlay">
                            <div className="name">
                                <span className="status-dot" style={{ background: isRemoteVideoActive ? 'var(--status-online)' : 'var(--text-muted)' }}></span>
                                {peerData.user?.name || `User ${peerId.slice(0, 4)}`}
                            </div>
                            <div className="status-icons">
                                {isRemoteMuted && <span>🔇</span>}
                                {peerData.user?.isDeafened && <span>🙉</span>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
