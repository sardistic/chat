"use client";

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });
import { Icon } from '@iconify/react';
import { useSocket } from '@/lib/socket';

export default function TubeTile({
    tubeState, // { videoId, isPlaying, timestamp, lastUpdate }
    isOwner,   // If true, shows controls to change video
    settings = { volume: 1, isLocallyMuted: false, isVideoHidden: false },
    onSync,    // Callback when player reports progress/state
    onChangeVideo, // Callback to change video
    width,
    height
}) {
    const { socket } = useSocket();
    const playerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);

    // UI State
    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState('');

    // Search State
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    const ignorePauseRef = useRef(false);

    // Sync Logic
    // Sync Logic
    useEffect(() => {
        if (!playerRef.current || !tubeState.videoId || !isReady) return;

        const checkSync = () => {
            const player = playerRef.current;
            // Calculate where we SHOULD be
            const timeSinceUpdate = (Date.now() - tubeState.lastUpdate) / 1000;
            const serverTime = tubeState.timestamp + (tubeState.isPlaying ? timeSinceUpdate : 0);
            const localTime = player.getCurrentTime();

            // 1. Check Playback State
            // ReactPlayer prop 'playing' handles this usually, but if we drift or get stuck:
            // If server is playing, we should be playing.

            // 2. Check Time Drift
            const drift = Math.abs(localTime - serverTime);

            // If drift is massive (> 5s), hard seek
            // If drift is moderate (> 2s), seek
            if (drift > 2) {
                console.log(`[Tube] Drift detected (${drift.toFixed(2)}s). Seeking to ${serverTime.toFixed(2)}s`);
                ignorePauseRef.current = true;
                player.seekTo(serverTime, 'seconds');
                setTimeout(() => { ignorePauseRef.current = false; }, 1000);
            }
        };

        // Run sync check immediately then interval
        checkSync();
        const interval = setInterval(checkSync, 1000);
        return () => clearInterval(interval);

    }, [tubeState, isReady]);



    // Error Reset when video changes
    useEffect(() => {
        setHasError(false);
        setIsReady(false);
    }, [tubeState.videoId]);

    const handleSearch = (query) => {
        if (!socket) return;
        setIsSearching(true);
        setSearchResults([]);

        socket.emit('tube-search', { query }, (response) => {
            setIsSearching(false);
            if (response && response.success) {
                setSearchResults(response.videos);
            } else {
                setSearchResults([]); // Handle error via UI feedback if needed
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const val = inputValue.trim();
        if (!val) return;

        // Check if URL
        const isUrl = val.startsWith('http') || val.includes('youtube.com') || val.includes('youtu.be');

        if (isUrl) {
            onChangeVideo(val);
            setShowInput(false);
            setInputValue('');
            setSearchResults([]);
        } else {
            // It's a search term
            handleSearch(val);
        }
    };

    const handleSelectResult = (video) => {
        onChangeVideo(video.url);
        setShowInput(false);
        setInputValue('');
        setSearchResults([]);
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

    const renderInputModal = () => {
        if (!showInput) return null;
        return (
            <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '24px', zIndex: 50, overflowY: 'auto'
            }}>
                <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                        <h3 style={{ margin: 0, fontSize: '14px' }}>Load Video</h3>
                        <button onClick={() => setShowInput(false)} style={{ background: 'transparent', border: 'none', color: 'gray', cursor: 'pointer' }}>
                            <Icon icon="fa:times" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="Paste URL or Search..."
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
                        <button type="submit" className="btn primary" style={{ padding: '8px 12px' }} disabled={isSearching}>
                            {isSearching ? <Icon icon="eos-icons:loading" /> : <Icon icon="fa:search" />}
                        </button>
                    </form>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                            {searchResults.map((video, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSelectResult(video)}
                                    style={{
                                        display: 'flex', gap: '10px', padding: '8px',
                                        background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
                                        cursor: 'pointer', transition: 'background 0.2s'
                                    }}
                                    className="search-result-item"
                                >
                                    <div style={{ width: '60px', height: '34px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                                        <img src={video.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ color: 'white', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {video.title}
                                        </div>
                                        <div style={{ color: 'gray', fontSize: '10px', display: 'flex', gap: '6px' }}>
                                            <span>{video.author}</span>
                                            <span>•</span>
                                            <span>{video.duration}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPlaceholder = () => (
        <div className="tile" style={style}>
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(ellipse at center, #2a0000 0%, #000 100%)',
                flexDirection: 'column',
                gap: '12px',
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                padding: '20px'
            }}>
                <Icon icon="fa:youtube-play" width="48" color="#ff0000" />
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>THE TUBE</div>

                {isOwner ? (
                    <button
                        onClick={() => setShowInput(true)}
                        className="btn primary"
                        style={{ fontSize: '12px', padding: '6px 12px', marginTop: '8px' }}
                    >
                        Load Video
                    </button>
                ) : (
                    <div style={{ fontSize: '12px', opacity: 0.5 }}>Waiting for video...</div>
                )}
            </div>
            {renderInputModal()}
        </div>
    );

    // Initial Empty State
    if (!tubeState?.videoId) {
        return renderPlaceholder();
    }

    const videoUrl = tubeState.videoId.startsWith('http') ? tubeState.videoId : `https://www.youtube.com/watch?v=${tubeState.videoId}`;
    console.log("[TubeTile] Rendering URL:", videoUrl, "Playing:", tubeState.isPlaying, "IsOwner:", isOwner);

    return (
        <div className="tile video-tile" style={{ ...style, borderColor: tubeState.isPlaying ? '#ff0000' : 'rgba(255,0,0,0.3)' }}>
            <div style={{ width: '100%', height: '100%', pointerEvents: isOwner ? 'auto' : 'none', position: 'relative' }}>
                <ReactPlayer
                    key={videoUrl} // Force remount on URL change to avoid internal state bugs
                    ref={playerRef}
                    url={videoUrl}
                    width="100%"
                    height="100%"
                    controls={true} // Force controls for debug
                    playing={tubeState.isPlaying}
                    muted={settings.isLocallyMuted || settings.volume === 0}
                    volume={settings.volume}
                    playsinline={true}
                    config={{
                        youtube: {
                            playerVars: {
                                showinfo: 0,
                                modestbranding: 1,
                                origin: typeof window !== 'undefined' ? window.location.origin : undefined
                            }
                        }
                    }}
                    onReady={() => { console.log("[TubeTile] Player READY"); setIsReady(true); }}
                    onStart={() => console.log("[TubeTile] Player START")}
                    onBuffer={() => console.log("[TubeTile] Player BUFFER")}
                    onError={(e) => {
                        console.error("[TubeTile] Player ERROR:", e);
                        setHasError(true);
                    }}
                    onProgress={(state) => {
                        // console.log("[TubeTile] Progress:", state.playedSeconds);
                        if (isOwner && onSync) {
                            onSync({ ...state, type: 'progress' });
                        }
                    }}
                    onPlay={() => {
                        console.log("[TubeTile] Player PLAY event");
                        isOwner && onSync && onSync({ type: 'play' });
                    }}
                    onPause={() => {
                        if (ignorePauseRef.current) {
                            console.log("[TubeTile] Ignoring pause event due to seek");
                            return;
                        }
                        console.log("[TubeTile] Player PAUSE event");
                        if (isOwner && onSync) onSync({ type: 'pause' });
                    }}
                    style={{ opacity: (settings.isVideoHidden || hasError) ? 0 : 1 }}
                />

                {/* Error Overlay - Render ON TOP of player, do not unmount player */}
                {hasError && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.8)',
                        flexDirection: 'column', gap: '12px', color: '#eab308',
                        zIndex: 5
                    }}>
                        <Icon icon="fa:exclamation-triangle" width="48" />
                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>VIDEO UNAVAILABLE</div>
                        {isOwner && (
                            <button
                                onClick={() => { setShowInput(true); }}
                                className="btn primary"
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                                Try Another Video
                            </button>
                        )}
                        {!isOwner && <div style={{ fontSize: '12px', opacity: 0.7 }}>The owner is fixing this...</div>}
                    </div>
                )}
            </div>

            {/* Name Label */}
            <div className="tile-name" style={{
                position: 'absolute', bottom: '8px', left: '8px',
                background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px',
                fontSize: '12px', fontWeight: '600', color: 'white',
                display: 'flex', alignItems: 'center', gap: '6px',
                pointerEvents: 'none',
                zIndex: 10
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
                        <Icon icon="fa:search" />
                    </button>
                    <button
                        onClick={() => onChangeVideo('')} // Clear video
                        style={{
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px',
                            color: 'white', padding: '4px', cursor: 'pointer'
                        }}
                        title="Stop / Eject"
                    >
                        <Icon icon="fa:eject" />
                    </button>
                </div>
            )}

            {renderInputModal()}
        </div>
    );
}
