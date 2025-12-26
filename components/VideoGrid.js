"use client";

import { useEffect, useRef } from "react";

export default function VideoGrid({ localStream, peers, localUser, isVideoEnabled, isAudioEnabled }) {
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

    // Calculate total number of videos (including local if broadcasting)
    const totalVideos = (localStream ? 1 : 0) + peerArray.length;

    // Auto-calculate optimal grid columns (Railway style: bigger cards)
    // 1-2 users: 1 col (full width or half)
    // 3-4 users: 2 cols
    // 5+ users: 3 cols
    // Responsive grid handled by CSS grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))
    // We can rely on CSS grid auto-placement mostly.

    return (
        <div className="grid">
            {/* Local User Tile */}
            <div className="tile">
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
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#242424' }}>
                        <img
                            src={localUser?.avatar || `/api/avatar/${localUser?.name}`}
                            alt={localUser?.name}
                            style={{ width: '80px', height: '80px', opacity: 0.8 }}
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

                return (
                    <div key={peerId} className="tile">
                        {isRemoteVideoActive ? (
                            <video
                                ref={(el) => {
                                    if (el) {
                                        peerVideoRefs.current.set(peerId, el);
                                        // Ensure stream is set when mounting
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
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#242424' }}>
                                <img
                                    src={peerData.user?.avatar || `/api/avatar/${peerData.user?.name || 'User'}`}
                                    alt={peerData.user?.name}
                                    style={{ width: '80px', height: '80px', opacity: 0.5, filter: 'grayscale(100%)' }}
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

// Helper to check if local video is active (passed as prop existence)
function isBroadcasting() {
    return true; // We can assume yes if this renders, or use props
}
