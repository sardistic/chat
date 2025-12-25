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

    // Auto-calculate optimal grid columns based on number of videos
    let gridColumns = 1;
    if (totalVideos >= 9) gridColumns = 4;
    else if (totalVideos >= 4) gridColumns = 3;
    else if (totalVideos >= 2) gridColumns = 2;

    // Dynamic grid style based on number of videos
    const gridStyle = {
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
    };

    return (
        <div className="grid" style={gridStyle}>
            {/* Local User Tile */}
            <div className="tile">
                <div className="video">
                    {localStream && (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: 'scaleX(-1)' // Mirror local video
                            }}
                        />
                    )}
                </div>
                <div className="noise"></div>
                <div className="hud">
                    <div className="badge">
                        <span className="mini-dot" style={{
                            background: 'var(--good)',
                            boxShadow: '0 0 0 3px rgba(34,197,94,.18)'
                        }}></span>
                        <span className="name">{localUser?.name || 'You'} (You)</span>
                    </div>
                    <div className="icons">
                        <span className="ico">{isAudioEnabled ? '🎤' : '🔇'}</span>
                        <span className="ico">{isVideoEnabled ? '📹' : '🚫'}</span>
                    </div>
                </div>
                <div className="footer">
                    <div className="meter">
                        <div className="bars"><span></span><span></span><span></span><span></span></div>
                        <div className="txt">Broadcasting</div>
                    </div>
                    <div className="chip">HD • 30fps</div>
                </div>
            </div>

            {/* Remote Peer Tiles */}
            {peerArray.map(([peerId, peerData]) => (
                <div key={peerId} className="tile">
                    <div className="video">
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
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                    <div className="noise"></div>
                    <div className="hud">
                        <div className="badge">
                            <span className="mini-dot" style={{
                                background: 'var(--good)',
                                boxShadow: '0 0 0 3px rgba(34,197,94,.18)'
                            }}></span>
                            <span className="name">User {peerId.slice(0, 6)}</span>
                        </div>
                        <div className="icons">
                            <span className="ico">🔊</span>
                            <span className="ico">📹</span>
                        </div>
                    </div>
                    <div className="footer">
                        <div className="meter">
                            <div className="bars"><span></span><span></span><span></span><span></span></div>
                            <div className="txt">Active</div>
                        </div>
                        <div className="chip">HD • 30fps</div>
                    </div>
                </div>
            ))}

        </div>
    );
}
