import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/lib/socket';

export function useYouTubeSync(roomId, user) {
    const { socket } = useSocket();
    const [receivedAt, setReceivedAt] = useState(Date.now());
    const [tubeState, setTubeState] = useState({
        videoId: null,
        isPlaying: false,
        currentPosition: 0,
        pausedAt: 0,
        lastUpdate: 0,
        ownerId: null
    });

    // Client-side dedup: track last sent videoId to prevent rapid duplicates
    const lastSentVideoRef = useRef({ videoId: null, timestamp: 0 });

    // Listen for updates from server
    useEffect(() => {
        if (!socket) return;

        const handleStateUpdate = (newState) => {
            setTubeState(prev => ({
                ...prev,
                ...newState,
                currentPosition: newState.currentPosition ?? prev.currentPosition
            }));
            setReceivedAt(Date.now());
        };

        const handleSyncUpdate = (syncData) => {
            setTubeState(prev => ({
                ...prev,
                currentPosition: syncData.currentPosition,
                isPlaying: syncData.isPlaying
            }));
            setReceivedAt(Date.now());
        };

        socket.on('tube-state', handleStateUpdate);
        socket.on('tube-sync', handleSyncUpdate);

        socket.emit('tube-request-state', { roomId });

        return () => {
            socket.off('tube-state', handleStateUpdate);
            socket.off('tube-sync', handleSyncUpdate);
        };
    }, [socket, roomId]);

    // Function to broadcast updates
    const updateTubeState = useCallback((partialState) => {
        if (!socket) return;

        // CLIENT-SIDE DEDUP: Block rapid duplicate video changes
        if (partialState.videoId) {
            const now = Date.now();
            const lastSent = lastSentVideoRef.current;

            // Extract video ID for consistent comparison
            let videoId = partialState.videoId;
            if (videoId.includes('v=')) {
                videoId = videoId.split('v=')[1].split('&')[0];
            } else if (videoId.includes('youtu.be/')) {
                videoId = videoId.split('youtu.be/')[1].split('?')[0];
            }

            // If same video was sent within last 5 seconds, block
            if (lastSent.videoId === videoId && (now - lastSent.timestamp) < 5000) {
                console.log(`[useYouTubeSync] Blocking duplicate videoId: ${videoId}`);
                return;
            }

            // Record this send
            lastSentVideoRef.current = { videoId, timestamp: now };
        }

        const newState = {
            ...partialState,
            ownerId: socket.id
        };

        setTubeState(prev => ({ ...prev, ...newState }));

        socket.emit('tube-update', {
            roomId,
            ...newState,
            timestamp: newState.timestamp ?? newState.currentPosition ?? tubeState.currentPosition
        });
    }, [socket, roomId, tubeState]);

    const isOwner = !tubeState.ownerId || tubeState.ownerId === socket?.id;

    return {
        tubeState,
        receivedAt,
        updateTubeState,
        isOwner
    };
}
