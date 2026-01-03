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
    onReaction, // Callback for reactions
    onMuteChange, // callback for mute state (isListening)
    width,
    height
}) {
    const { socket } = useSocket();
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [debugStatus, setDebugStatus] = useState('Initializing...'); // [NEW] Debug Output
    const [isMuted, setIsMuted] = useState(true); // Track mute state for our custom button

    // UI State
    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [showReactionPicker, setShowReactionPicker] = useState(false);

    // Search State
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [retryKey, setRetryKey] = useState(0);
    const [loadTimeout, setLoadTimeout] = useState(false);
    const [forceSyncTrigger, setForceSyncTrigger] = useState(0);

    const ignorePauseRef = useRef(false);
    const ignorePlayRef = useRef(false); // Suppress duplicate play events on video load
    const ytPlayerRef = useRef(null);
    const playerContainerRef = useRef(null);
    const isOwnerRef = useRef(isOwner);
    const currentVideoIdRef = useRef(null); // Track current video to prevent re-init loops

    // Initialize mute state (default muted for autoplay policy)
    const userMutedRef = useRef(true);

    // State for local interaction (Click-to-Play)
    const [hasInteracted, setHasInteracted] = useState(false);
    const [autoplayEnabled, setAutoplayEnabled] = useState(false); // Default false
    const autoplayRef = useRef(false);

    // Sync ref
    useEffect(() => {
        autoplayRef.current = autoplayEnabled;
    }, [autoplayEnabled]);

    // Load autoplay preference
    useEffect(() => {
        const savedAuto = localStorage.getItem('tube-autoplay');
        if (savedAuto !== null) {
            setAutoplayEnabled(savedAuto === 'true');
        } else {
            setAutoplayEnabled(false); // Default off
        }

        // Load mute state
        const savedMuted = localStorage.getItem('tube-muted');
        if (savedMuted !== null) {
            const mutedValue = savedMuted === 'true';
            userMutedRef.current = mutedValue;
            setIsMuted(mutedValue);
        }
    }, []);

    // Save autoplay preference
    const toggleAutoplay = () => {
        const newState = !autoplayEnabled;
        setAutoplayEnabled(newState);
        localStorage.setItem('tube-autoplay', newState); // Using localStorage as it's client preference
    };

    // Auto-start if autoplay is enabled and we have a video
    useEffect(() => {
        // Handle auto-interaction update if needed
        if (autoplayRef.current && !hasInteracted) {
            setHasInteracted(true);
            // The actual play command comes from the tubeState sync effect
        }
    }, [autoplayEnabled, hasInteracted]);

    // Initialize Player when API is ready and videoID exists
    useEffect(() => {
        if (!tubeState?.videoId) return;

        // ... (ID extraction logic) ... 
        let embedId = tubeState.videoId;
        if (tubeState.videoId.includes('v=')) {
            embedId = tubeState.videoId.split('v=')[1].split('&')[0];
        } else if (tubeState.videoId.includes('youtu.be/')) {
            embedId = tubeState.videoId.split('youtu.be/')[1].split('?')[0];
        }

        const onPlayerReady = (event) => {
            setIsReady(true);
            setLoadTimeout(false);

            // Only play if we have interacted OR autoplay is enabled
            // We'll handle exact play/pause in the tubeState effect
            // But we need to update volume/mute

            const savedMuted = localStorage.getItem('tube-muted');
            const shouldMute = savedMuted === null ? true : savedMuted === 'true';

            if (shouldMute) {
                event.target.mute();
            } else {
                event.target.unMute();
                event.target.setVolume(settings.volume * 100);
            }
            userMutedRef.current = shouldMute;
        };

        const onPlayerStateChange = (event) => {
            // OWNER ONLY: Sync logic
            // Use ref to avoid stale closure / re-init loops
            if (!isOwnerRef.current) return;

            // Safety check: Ensure target has the method (it might be missing on error events)
            const currentTime = event.target?.getCurrentTime ? event.target.getCurrentTime() : 0;
            if (event.data === 1) { // Playing
                // Skip duplicate play event on video load (onChangeVideo already sent isPlaying: true)
                if (ignorePlayRef.current) {
                    ignorePlayRef.current = false;
                    return;
                }
                if (onSync) onSync({ type: 'play', playedSeconds: currentTime });
            } else if (event.data === 2) { // Paused
                if (ignorePauseRef.current) return;
                if (onSync) onSync({ type: 'pause', playedSeconds: currentTime });
            } else if (event.data === 0) { // Ended
                if (onSync) onSync({ type: 'ended', playedSeconds: 0 });
            }
        };

        const initPlayer = () => {
            if (!playerContainerRef.current) return;

            // SKIP if already playing this video (prevent infinite loops)
            if (currentVideoIdRef.current === embedId && ytPlayerRef.current) {
                console.log("[Tube-Init] Same video, skipping reinit:", embedId);
                return;
            }

            // DESTROY existing player when video changes
            if (ytPlayerRef.current) {
                try {
                    // CAPTURE mute state before destruction
                    if (ytPlayerRef.current.isMuted) {
                        userMutedRef.current = ytPlayerRef.current.isMuted();
                        console.log("[Tube-Init] Saved mute state:", userMutedRef.current);
                    }
                    console.log("[Tube-Init] Destroying old player for new video");
                    ytPlayerRef.current.destroy();
                } catch (err) {
                    console.error("[Tube-Sync] Destroy Error:", err);
                }
                ytPlayerRef.current = null;
            }

            // Track this video ID
            currentVideoIdRef.current = embedId;

            // ALWAYS suppress the first play event after loading a new video
            ignorePlayRef.current = true;

            // ALWAYS RESET DOM: The API replaces the div with an iframe. 
            // If we retry, we must recreate the div or the API will fail to attach to an existing iframe.
            if (playerContainerRef.current) {
                playerContainerRef.current.innerHTML = '<div id="tube-player-target" style="width:100%;height:100%;"></div>';
            }

            if (window.YT && window.YT.Player) {
                // Wait a bit to ensure target DIV is truly in DOM
                setTimeout(() => {
                    if (!playerContainerRef.current) return;
                    setDebugStatus('API Ready. Creating Player...');

                    // Read mute preference from localStorage
                    const savedMuted = localStorage.getItem('tube-muted');
                    const shouldStartMuted = savedMuted === null ? 1 : (savedMuted === 'true' ? 1 : 0);
                    console.log("[Tube-Init] Initializing YT Player for:", embedId, "mute:", shouldStartMuted);

                    ignorePlayRef.current = true; // Skip the first play event
                    try {
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
                                'autoplay': 0, // Default paused - user must click to join
                                'mute': shouldStartMuted, // Dynamic based on user preference
                                'enablejsapi': 1
                            },
                            events: {
                                'onReady': onPlayerReady,
                                'onStateChange': onPlayerStateChange,
                                'onError': (e) => {
                                    console.error("[TubeTile-Native] Error:", e);
                                    setDebugStatus(`Error: ${e.data}`);
                                    if (e.data === 101 || e.data === 150 || e.data === 100) {
                                        setHasError(true);
                                    }
                                }
                            }
                        });
                        setDebugStatus('Player Object Created...');
                    } catch (e) {
                        setDebugStatus(`Constructor Error: ${e.message}`);
                    }
                }, 200);
            } else {
                setDebugStatus('Waiting for YouTube API...');
                // Fallback: If global script failed, inject strictly here
                if (!document.getElementById('yt-api-script')) {
                    const tag = document.createElement('script');
                    tag.src = "https://www.youtube.com/iframe_api";
                    tag.id = "yt-api-script";
                    document.body.appendChild(tag);
                }

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

        // Poll YT player's mute state to track user mute/unmute actions
        const muteCheckInterval = setInterval(() => {
            if (ytPlayerRef.current) {
                try {
                    // Check if player is strictly muted
                    const pMuted = ytPlayerRef.current.isMuted();
                    // Also check volume (if volume is 0, practically muted)
                    const pVolume = ytPlayerRef.current.getVolume();
                    const effectiveMute = pMuted || pVolume === 0;

                    if (userMutedRef.current !== effectiveMute) {
                        console.log('[TubeTile] Mute state changed:', effectiveMute);
                        userMutedRef.current = effectiveMute;
                        setIsMuted(effectiveMute);

                        // Notify parent (for dancing avatars)
                        if (onMuteChange) onMuteChange(!effectiveMute);

                        // Persist to localStorage
                        localStorage.setItem('tube-muted', String(effectiveMute));
                    }
                } catch (e) {
                    // Player might not be ready yet
                }
            }
        }, 500); // Check more frequently

        initPlayer();
        return () => {
            clearTimeout(checkTimeout);
            clearInterval(muteCheckInterval);
        };
    }, [tubeState?.videoId, retryKey]); // Removed isReady to prevent infinite loops

    // Sync Effect - Use server-calculated currentPosition
    useEffect(() => {
        if (!ytPlayerRef.current || !isReady || !ytPlayerRef.current.getPlayerState) return;

        const playerState = ytPlayerRef.current.getPlayerState();
        if (tubeState.isPlaying && playerState !== 1 && playerState !== 3) {
            ytPlayerRef.current.playVideo();
        } else if (!tubeState.isPlaying && playerState === 1) {
            ytPlayerRef.current.pauseVideo();
        }

        // Skip sync correction for owner (they're the source)
        if (isOwner) return;

        // Use server-provided currentPosition directly
        const serverPosition = tubeState.currentPosition;
        if (serverPosition === undefined || serverPosition === null) return;

        const currentTime = ytPlayerRef.current.getCurrentTime();
        const drift = Math.abs(currentTime - serverPosition);

        // Reduced threshold from 2s to 0.5s for tighter sync
        if (drift > 0.5 || forceSyncTrigger > 0) {
            console.log(`[Tube-Sync] Correcting. Drift: ${drift.toFixed(2)}s -> ${serverPosition.toFixed(2)}s`);
            ignorePauseRef.current = true;
            ytPlayerRef.current.seekTo(serverPosition, true);
            setTimeout(() => { ignorePauseRef.current = false; }, 500);
        }
    }, [tubeState, isReady, isOwner, forceSyncTrigger]);

    // Owner heartbeat removed - server now handles sync broadcasts

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
            // AUTO-UNMUTE: DJ should hear the track they picked
            userMutedRef.current = false;
            setIsMuted(false);
            localStorage.setItem('tube-muted', 'false');
            if (onMuteChange) onMuteChange(true);

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
        // AUTO-UNMUTE: DJ should hear the track they picked
        userMutedRef.current = false;
        setIsMuted(false);
        localStorage.setItem('tube-muted', 'false');
        if (onMuteChange) onMuteChange(true); // true = isListening (unmuted)

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
                    {/* Click to Play Overlay */}
                    {!hasInteracted && tubeState?.videoId && (
                        <div
                            className="tube-overlay"
                            onClick={() => {
                                setHasInteracted(true);
                                // Actually start playback
                                if (ytPlayerRef.current) {
                                    try { ytPlayerRef.current.unMute(); } catch (e) { }
                                    try { ytPlayerRef.current.playVideo(); } catch (e) { }
                                    // Sync to server time
                                    try {
                                        const serverPos = tubeState?.currentPosition || 0;
                                        const lag = (Date.now() - (receivedAt || Date.now())) / 1000;
                                        const target = serverPos + lag;
                                        if (target > 0 && Number.isFinite(target)) {
                                            ytPlayerRef.current.seekTo(target, true);
                                        }
                                    } catch (e) { }
                                }
                            }}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.7)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 20,
                                cursor: 'pointer'
                            }}
                        >
                            <Icon icon="mdi:play-circle-outline" width="64" height="64" color="white" />
                            <span style={{ color: 'white', marginTop: '16px', fontWeight: '500' }}>Click to Join Stream</span>

                            <div
                                onClick={(e) => { e.stopPropagation(); toggleAutoplay(); }}
                                style={{
                                    marginTop: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: '#ccc'
                                }}
                            >
                                <div style={{
                                    width: '32px',
                                    height: '18px',
                                    background: autoplayEnabled ? '#4ade80' : '#4b5563',
                                    borderRadius: '10px',
                                    position: 'relative',
                                    transition: 'background 0.2s'
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        width: '14px',
                                        height: '14px',
                                        background: 'white',
                                        borderRadius: '50%',
                                        top: '2px',
                                        left: autoplayEnabled ? '16px' : '2px',
                                        transition: 'left 0.2s'
                                    }} />
                                </div>
                                <span>Autoplay on join</span>
                            </div>
                        </div>
                    )}

                    {/* Video Player Container */}
                    <div
                        ref={playerContainerRef}
                        className="youtube-player"
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
                            <Icon icon="eos-icons:bubble-loading" width="32" />
                            <div style={{ fontSize: '12px' }}>Loading Player...</div>
                            <div style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{debugStatus}</div>
                            {loadTimeout && (
                                <button
                                    onClick={() => {
                                        // Force Re-init and server pull
                                        setRetryKey(k => k + 1);
                                        if (socket) socket.emit('tube-request-state', { roomId: 'default' }); // Force server pull
                                        setIsReady(false);
                                        setLoadTimeout(false);
                                    }}
                                    className="btn primary"
                                    style={{ fontSize: '10px', padding: '4px 8px', marginTop: '8px', background: '#ff4444' }}
                                >
                                    Force Reset Player
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
                </div>
            )
            }

            {/* Name Label */}
            <div className="tile-name" style={{
                position: 'absolute', bottom: '50px', left: '8px',
                background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px',
                fontSize: '11px', fontWeight: '600', color: 'white',
                display: 'flex', alignItems: 'center', gap: '6px',
                pointerEvents: 'none',
                zIndex: 10,
                border: isOwner ? '1px solid #ff0000' : '1px solid rgba(255,255,255,0.2)'
            }}>
                <Icon icon={isOwner ? "fa:user-circle" : "fa:link"} color={isOwner ? "#ff0000" : "#00f2ff"} />
                {isOwner ? 'YOU ARE DJ' : 'SYNCED TO HOST'}
            </div>

            {/* Reaction Button - Bottom Right */}
            {
                onReaction && (
                    <div
                        className="reaction-control"
                        style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            zIndex: 15,
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(0,0,0,0.6)',
                            borderRadius: '14px',
                            padding: '4px 8px',
                            gap: '2px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowReactionPicker(!showReactionPicker);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '4px',
                                lineHeight: 1
                            }}
                            title="React"
                        >
                            {showReactionPicker ? '✕' : '❤️'}
                        </button>
                        {showReactionPicker && ['❤️', '🔥', '😂', '😮', '👏', '🎉'].map(emoji => (
                            <button
                                key={emoji}
                                onClick={(e) => { e.stopPropagation(); onReaction(emoji); setShowReactionPicker(false); }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    padding: '4px',
                                    lineHeight: 1
                                }}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )
            }

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
                    onClick={() => {
                        // Previous - omit roomId so server uses socket.data.roomId
                        console.log('[TubeTile] PREV button clicked, socket:', !!socket);
                        if (socket) {
                            socket.emit('tube-update', { action: 'prev' });
                            console.log('[TubeTile] Emitted tube-update with action: prev');
                        }
                    }}
                    style={{
                        background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px',
                        color: 'white', padding: '4px', cursor: 'pointer'
                    }}
                    title="Previous"
                >
                    <Icon icon="fa:step-backward" />
                </button>
                {!tubeState?.isPlaying && (
                    <button
                        onClick={() => {
                            if (onSync) onSync({ type: 'play', playedSeconds: ytPlayerRef.current?.getCurrentTime() || 0 });
                        }}
                        style={{
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px',
                            color: 'white', padding: '4px', cursor: 'pointer'
                        }}
                        title="Resume"
                    >
                        <Icon icon="fa:play" />
                    </button>
                )}
                {tubeState?.isPlaying && (
                    <button
                        onClick={() => {
                            if (onSync) onSync({ type: 'pause', playedSeconds: ytPlayerRef.current?.getCurrentTime() || 0 });
                        }}
                        style={{
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px',
                            color: 'white', padding: '4px', cursor: 'pointer'
                        }}
                        title="Pause"
                    >
                        <Icon icon="fa:pause" />
                    </button>
                )}
                <button
                    onClick={() => {
                        // Next (Explicit Action) - omit roomId so server uses socket.data.roomId
                        console.log('[TubeTile] NEXT button clicked, socket:', !!socket);
                        if (socket) {
                            socket.emit('tube-update', { action: 'next' });
                            console.log('[TubeTile] Emitted tube-update with action: next');
                        }
                    }}
                    style={{
                        background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px',
                        color: 'white', padding: '4px', cursor: 'pointer'
                    }}
                    title="Next / Skip"
                >
                    <Icon icon="fa:step-forward" />
                </button>
                {/* Custom Mute/Unmute Button */}
                <button
                    onClick={() => {
                        if (ytPlayerRef.current) {
                            if (isMuted) {
                                ytPlayerRef.current.unMute();
                                ytPlayerRef.current.setVolume(settings.volume * 100);
                                setIsMuted(false);
                                localStorage.setItem('tube-muted', 'false');
                                console.log('[TubeTile] Custom unmute clicked, saved to localStorage');
                            } else {
                                ytPlayerRef.current.mute();
                                setIsMuted(true);
                                localStorage.setItem('tube-muted', 'true');
                                console.log('[TubeTile] Custom mute clicked, saved to localStorage');
                            }
                        }
                    }}
                    style={{
                        background: isMuted ? 'rgba(239, 68, 68, 0.8)' : 'rgba(0,0,0,0.6)',
                        border: 'none', borderRadius: '4px',
                        color: 'white', padding: '4px', cursor: 'pointer'
                    }}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    <Icon icon={isMuted ? "fa:volume-off" : "fa:volume-up"} />
                </button>
                <button
                    onClick={() => onChangeVideo('')} // Stop
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
        </div >
    );
}
