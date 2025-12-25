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
                <div className="overlay">
                    <div className="name">
                        <span className="status-dot" style={{ background: isBroadcasting() ? 'var(--status-online)' : 'var(--text-muted)' }}></span>
                        {localUser?.name || 'Local'} (You)
                    </div>
                </div>
            </div>

            {/* Remote Peer Tiles */}
            {peerArray.map(([peerId, peerData]) => (
                <div key={peerId} className="tile">
                    <video
                        ref={(el) => {
                            if (el) {
                                peerVideoRefs.current.set(peerId, el);
                            } else {
                                peerVideoRefs.current.delete(peerId);
                            }
                        }}
                        autoPlay
                        playsInline
                        className="video"
                    />
                    <div className="overlay">
                        <div className="name">
                            <span className="status-dot"></span>
                            {peerData.user?.name || `User ${peerId.slice(0, 4)}`}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Helper to check if local video is active (passed as prop existence)
function isBroadcasting() {
    return true; // We can assume yes if this renders, or use props
}
