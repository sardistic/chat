"use client";

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });
import { Icon } from '@iconify/react';

export default function TubeTile({
    tubeState, // { videoId, isPlaying, timestamp, lastUpdate }
    isOwner,   // If true, shows controls to change video
    settings = { volume: 1, isLocallyMuted: false, isVideoHidden: false },
    onSync,    // Callback when player reports progress/state (for owner to broadcast)
    onChangeVideo, // Callback to change video
    width,
    height
}) {
    const playerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [showInput, setShowInput] = useState(false);

    // Sync Logic
    // We strictly follow tubeState unless we are the owner interacting?
    // Actually, for a simple sync, everyone follows the server state.
    // Sync drift correction is handled by checking player.getCurrentTime() vs tubeState.timestamp + (now - lastUpdate)

    useEffect(() => {
        if (!playerRef.current || !tubeState.videoId || !isReady) return;

        const player = playerRef.current;
        const serverTime = tubeState.timestamp + (tubeState.isPlaying ? (Date.now() - tubeState.lastUpdate) / 1000 : 0);
        const localTime = player.getCurrentTime();

        // Seek if drift is > 2 seconds
        if (Math.abs(localTime - serverTime) > 2) {
            player.seekTo(serverTime, 'seconds');
        }

        // Sync Play/Pause
        // ReactPlayer 'playing' prop handles this effectively mostly, but we can enforce
    }, [tubeState, isReady]);

    const handleDuration = (duration) => {
        // console.log('onDuration', duration)
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onChangeVideo(inputValue.trim());
            setShowInput(false);
            setInputValue('');
        }
    };

    // Calculate tile dimensions style
    const style = {
        width: width || '100%',
        height: height || 'auto',
        background: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid rgba(255, 0, 0, 0.3)', // Red border for YouTube
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
    };

    if (!tubeState?.videoId) {
        return (
            <div className="tile" style={style}>
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'radial-gradient(ellipse at center, #2a0000 0%, #000 100%)',
                    flexDirection: 'column',
                    gap: '12px',
                    color: 'rgba(255,255,255,0.7)'
                }}>
                    <Icon icon="fa:youtube-play" width="48" color="#ff0000" />
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>THE TUBE</div>
                    {isOwner ? (
                        <button
                            onClick={() => setShowInput(true)}
                            className="btn primary"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                            Load Video
                        </button>
                    ) : (
                        <div style={{ fontSize: '12px', opacity: 0.5 }}>Waiting for video...</div>
                    )}
                </div>

                {/* URL Input Modal Overlay */}
                {showInput && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                    }}>
                        <form onSubmit={handleSubmit} style={{ width: '80%', display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="Paste YouTube URL..."
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    color: 'white',
                                    fontSize: '12px',
                                    outline: 'none'
                                }}
                                autoFocus
                            />
                            <button type="submit" className="btn primary" style={{ padding: '8px' }}>
                                <Icon icon="fa:play" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowInput(false)}
                                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                            >
                                <Icon icon="fa:times" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="tile video-tile" style={{ ...style, borderColor: tubeState.isPlaying ? '#ff0000' : 'rgba(255,0,0,0.3)' }}>
            <div style={{ width: '100%', height: '100%', pointerEvents: isOwner ? 'auto' : 'none' }}>
                <ReactPlayer
                    ref={playerRef}
                    url={tubeState.videoId.startsWith('http') ? tubeState.videoId : `https://www.youtube.com/watch?v=${tubeState.videoId}`}
                    width="100%"
                    height="100%"
                    controls={isOwner} // Only owner sees native controls? Or custom controls? Native is easier for now.
                    playing={tubeState.isPlaying}
                    muted={settings.isLocallyMuted || settings.volume === 0}
                    volume={settings.volume}
                    onReady={() => setIsReady(true)}
                    onProgress={(state) => {
                        if (isOwner && onSync) {
                            // Only owner broadcasts progress updates periodically?
                            // Actually, onProgress fires every second. we can debounce this up stack.
                            onSync({ ...state, type: 'progress' });
                        }
                    }}
                    onPlay={() => isOwner && onSync && onSync({ type: 'play' })}
                    onPause={() => isOwner && onSync && onSync({ type: 'pause' })}
                    style={{ opacity: settings.isVideoHidden ? 0 : 1 }}
                />
            </div>

            {/* Name Label */}
            <div className="tile-name" style={{
                position: 'absolute', bottom: '8px', left: '8px',
                background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px',
                fontSize: '12px', fontWeight: '600', color: 'white',
                display: 'flex', alignItems: 'center', gap: '6px',
                pointerEvents: 'none'
            }}>
                <Icon icon="fa:youtube" color="#ff0000" />
                Channel 1
            </div>

            {/* Admin Controls Overlay (Top Right) */}
            {isOwner && (
                <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    display: 'flex', gap: '4px', zIndex: 10
                }}>
                    <button
                        onClick={() => setShowInput(true)}
                        style={{
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px',
                            color: 'white', padding: '4px', cursor: 'pointer'
                        }}
                        title="Change Video"
                    >
                        <Icon icon="fa:eject" />
                    </button>
                </div>
            )}

            {/* Modal for changing video (duped from empty state, should extract but inline is fine for speed) */}
            {showInput && (
                <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20
                }}>
                    <form onSubmit={handleSubmit} style={{ width: '80%', display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="Paste YouTube URL..."
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '4px',
                                padding: '8px',
                                color: 'white',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                            autoFocus
                        />
                        <button type="submit" className="btn primary" style={{ padding: '8px' }}>
                            <Icon icon="fa:play" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowInput(false)}
                            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                        >
                            <Icon icon="fa:times" />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
