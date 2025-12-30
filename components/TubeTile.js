"use client";

import { useRef, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useSocket } from '@/lib/socket';

export default function TubeTile({
    tubeState, // { videoId, isPlaying, timestamp, lastUpdate, serverTime, ownerId }
    receivedAt, // Local timestamp when tubeState was received
    isOwner,   // If true, we are the sync master
    settings = { volume: 1, isLocallyMuted: false, isVideoHidden: false },
    onSync,    // Callback when player reports progress/state
    onChangeVideo, // Callback to change video
    width,
    height
}) {
    const { socket } = useSocket();
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);

    // UI State
    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState('');

    // Search State
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [retryKey, setRetryKey] = useState(0);
    const [loadTimeout, setLoadTimeout] = useState(false);

    const ignorePauseRef = useRef(false);
    const ytPlayerRef = useRef(null);
    const playerContainerRef = useRef(null);
    const isOwnerRef = useRef(isOwner);

    // Sync isOwner ref
    useEffect(() => {
        isOwnerRef.current = isOwner;
    }, [isOwner]);

    // Load YouTube API
    useEffect(() => {
        if (!window.YT || !window.YT.Player) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
    }, []);

    // Initialize Player when API is ready and videoID exists
    useEffect(() => {
        if (!tubeState?.videoId) return;

        // Extract ID
        let embedId = tubeState.videoId;
        if (tubeState.videoId.includes('v=')) {
            embedId = tubeState.videoId.split('v=')[1].split('&')[0];
        } else if (tubeState.videoId.includes('youtu.be/')) {
            embedId = tubeState.videoId.split('youtu.be/')[1].split('?')[0];
        }

        const onPlayerReady = (event) => {
            setIsReady(true);
            setLoadTimeout(false);
            if (tubeState.isPlaying) {
                event.target.playVideo();
            }
            // Set initial volume
            if (settings.isLocallyMuted) {
                event.target.mute();
            } else {
                event.target.setVolume(settings.volume * 100);
            }
        };

        const onPlayerStateChange = (event) => {
            // Use ref to avoid stale closure / re-init loops
            if (!isOwnerRef.current) return;

            const currentTime = event.target.getCurrentTime();
            if (event.data === 1) { // Playing
                if (onSync) onSync({ type: 'play', playedSeconds: currentTime });
            } else if (event.data === 2) { // Paused
                if (ignorePauseRef.current) return;
                if (onSync) onSync({ type: 'pause', playedSeconds: currentTime });
            }
        };

        const initPlayer = () => {
            if (!playerContainerRef.current) return;

            // If player exists, just update video
            if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
                try {
                    const currentUrl = ytPlayerRef.current.getVideoUrl ? ytPlayerRef.current.getVideoUrl() : '';
                    if (!currentUrl || !currentUrl.includes(embedId)) {
                        ytPlayerRef.current.loadVideoById(embedId);
                    }
                } catch (err) {
                    console.error("[Tube-Sync] Load Error:", err);
                    setHasError(true);
                }
                return;
            }

            // Create fresh player DIV inside the container if needed
            if (!document.getElementById('tube-player-target')) {
                playerContainerRef.current.innerHTML = '<div id="tube-player-target" style="width:100%;height:100%;"></div>';
            }

            if (window.YT && window.YT.Player) {
                // Wait one tick to ensure DOM is flush
                setTimeout(() => {
                    if (!playerContainerRef.current) return;

                    ytPlayerRef.current = new window.YT.Player('tube-player-target', {
                        height: '100%',
                        width: '100%',
                        videoId: embedId,
                        playerVars: {
                            'playsinline': 1,
                            'controls': 1,
                            'modestbranding': 1,
                            'rel': 0,
                            'origin': typeof window !== 'undefined' ? window.location.origin : '',
                            'autoplay': 1,
                            'mute': 1,
                            'enablejsapi': 1
                        },
                        events: {
                            'onReady': onPlayerReady,
                            'onStateChange': onPlayerStateChange,
                            'onError': (e) => {
                                console.error("[TubeTile-Native] Error:", e);
                                if (e.data === 101 || e.data === 150 || e.data === 100) {
                                    setHasError(true);
                                }
                            }
                        }
                    });
                }, 50);
            } else {
                const checkYT = setInterval(() => {
                    if (window.YT && window.YT.Player) {
                        clearInterval(checkYT);
                        initPlayer();
                    }
                }, 500);
            }
        };

        const checkTimeout = setTimeout(() => {
            if (!isReady) setLoadTimeout(true);
        }, 8000);

        initPlayer();
        return () => clearTimeout(checkTimeout);
    }, [tubeState?.videoId, retryKey, isReady]);

    // Sync Effect (Native)
    useEffect(() => {
        if (!ytPlayerRef.current || !isReady || !ytPlayerRef.current.getPlayerState) return;

        const playerState = ytPlayerRef.current.getPlayerState();
        if (tubeState.isPlaying && playerState !== 1 && playerState !== 3) {
            ytPlayerRef.current.playVideo();
        } else if (!tubeState.isPlaying && playerState === 1) {
            ytPlayerRef.current.pauseVideo();
        }

        const currentTime = ytPlayerRef.current.getCurrentTime();

        // --- SOURCE OF TRUTH CHECK ---
        // If we are the owner, we are the master clock. 
        // We should NEVER seek ourselves based on server echoes (to avoid feedback loops).
        if (isOwner) return;

        // Ensure we have a server timestamp to synchronize with
        if (!tubeState.serverTime) return;

        // STABLE SYNC CALCULATION
        // 1. Calculate the clock offset once per state update
        const offset = tubeState.serverTime - receivedAt;
        const estimatedServerNow = Date.now() + offset;
        const timeSinceUpdate = (estimatedServerNow - tubeState.lastUpdate) / 1000;
        const serverVideoTime = tubeState.timestamp + (tubeState.isPlaying ? timeSinceUpdate : 0);

        const drift = Math.abs(currentTime - serverVideoTime);

        if (drift > 3) {
            console.log(`[Tube-Sync] Drift: ${drift.toFixed(2)}s. Seeking to ${serverVideoTime.toFixed(2)}s. (Offset: ${offset}ms)`);
            ignorePauseRef.current = true;
            ytPlayerRef.current.seekTo(serverVideoTime, true);
            setTimeout(() => { ignorePauseRef.current = false; }, 1000);
        }
    }, [tubeState, isReady, receivedAt, isOwner]);

    // Owner Heartbeat: Periodically sync progress to server
    useEffect(() => {
        if (!isOwner || !isReady || !ytPlayerRef.current || !ytPlayerRef.current.getCurrentTime) return;

        const heartbeat = setInterval(() => {
            if (tubeState.isPlaying) {
                const currentTime = ytPlayerRef.current.getCurrentTime();
                if (onSync) onSync({ type: 'progress', playedSeconds: currentTime });
            }
        }, 5000); // Every 5 seconds

        return () => clearInterval(heartbeat);
    }, [isOwner, isReady, tubeState.isPlaying]);

    // Error Reset when video changes
    useEffect(() => {
        setHasError(false);
        setIsReady(false);
        setRetryKey(k => k + 1); // Auto-retry once on vid change
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
                setSearchResults([]);
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

    return (
        <div className="tile video-tile" style={{ ...style, borderColor: (tubeState?.videoId && tubeState.isPlaying) ? '#ff0000' : 'rgba(255,0,0,0.3)' }}>
            {!tubeState?.videoId ? (
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

                    <button
                        onClick={() => setShowInput(true)}
                        className="btn primary"
                        style={{ fontSize: '12px', padding: '6px 12px', marginTop: '8px' }}
                    >
                        Load Video
                    </button>
                </div>
            ) : (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    {/* Persistent Isolated Container for YT Iframe */}
                    <div
                        ref={playerContainerRef}
                        style={{ width: '100%', height: '100%' }}
                        id="yt-player-container"
                    ></div>

                    {!isReady && !hasError && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#0a0a0a',
                            flexDirection: 'column', gap: '12px', color: 'rgba(255,255,255,0.5)',
                            zIndex: 1
                        }}>
                            <Icon icon="eos-icons:bubble-loading" width="32" />
                            <div style={{ fontSize: '12px' }}>Loading Player...</div>
                            {loadTimeout && (
                                <button
                                    onClick={() => setRetryKey(k => k + 1)}
                                    className="btn primary"
                                    style={{ fontSize: '10px', padding: '4px 8px', marginTop: '8px' }}
                                >
                                    Force Start
                                </button>
                            )}
                        </div>
                    )}

                    {hasError && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.8)',
                            flexDirection: 'column', gap: '12px', color: '#eab308',
                            zIndex: 5
                        }}>
                            <Icon icon="fa:exclamation-triangle" width="48" />
                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>CONNECTION ISSUE</div>
                            <button
                                onClick={() => {
                                    setHasError(false);
                                    setIsReady(false);
                                    ytPlayerRef.current = null;
                                    setRetryKey(prev => prev + 1);
                                }}
                                className="btn primary"
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                                Try Refreshing Tile
                            </button>
                            <div style={{ fontSize: '12px', opacity: 0.7 }}>If this persists, check if the video is restricted.</div>
                        </div>
                    )}

                    {/* Tap to Sync / Join Playback (Mainly for Mobile Autoplay Policy) */}
                    {!isOwner && isReady && !hasError && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.1)',
                            zIndex: 2,
                            pointerEvents: 'none'
                        }}>
                            <button
                                className="btn primary"
                                style={{
                                    pointerEvents: 'auto',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    background: '#ff0000',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 15px rgba(255,0,0,0.4)',
                                    fontSize: '13px'
                                }}
                                onClick={() => {
                                    if (ytPlayerRef.current && ytPlayerRef.current.playVideo) {
                                        ytPlayerRef.current.playVideo();
                                        ytPlayerRef.current.unMute();
                                    }
                                }}
                            >
                                <Icon icon="fa:play" style={{ marginRight: '8px' }} />
                                JOIN PLAYBACK
                            </button>
                        </div>
                    )}
                </div>
            )}

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
                {isOwner ? 'You are DJ' : 'Following Host'}
            </div>

            {/* DJ Controls Overlay (Top Right) */}
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

            {renderInputModal()}
        </div>
    );
}
