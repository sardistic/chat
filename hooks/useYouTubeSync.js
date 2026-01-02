import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/lib/socket';

export function useYouTubeSync(roomId, user) {
    const { socket } = useSocket();
    const [receivedAt, setReceivedAt] = useState(Date.now());
    const [tubeState, setTubeState] = useState({
        videoId: null,
        isPlaying: false,
        currentPosition: 0,  // Server-calculated position
        pausedAt: 0,
        lastUpdate: 0,
        ownerId: null
    });

    // Listen for updates from server
    useEffect(() => {
        if (!socket) return;

        // Full state updates (on join, video change, play/pause)
        const handleStateUpdate = (newState) => {
            setTubeState(prev => ({
                ...prev,
                ...newState,
                // Use currentPosition from server if available
                currentPosition: newState.currentPosition ?? prev.currentPosition
            }));
            setReceivedAt(Date.now());
        };

        // Frequent sync updates (every 2 seconds during playback)
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

        // Request initial state on join
        socket.emit('tube-request-state', { roomId });

        return () => {
            socket.off('tube-state', handleStateUpdate);
            socket.off('tube-sync', handleSyncUpdate);
        };
    }, [socket, roomId]);

    // Function to broadcast updates
    const updateTubeState = useCallback((partialState) => {
        if (!socket) return;

        const newState = {
            ...partialState,
            ownerId: socket.id
        };

        // OPTIMISTIC UPDATE for UI responsiveness
        setTubeState(prev => ({ ...prev, ...newState }));

        socket.emit('tube-update', {
            roomId,
            ...newState,
            timestamp: newState.timestamp ?? newState.currentPosition ?? tubeState.currentPosition
        });
    }, [socket, roomId, tubeState]);

    // We are the owner if we set the last state OR if no owner exists
    const isOwner = !tubeState.ownerId || tubeState.ownerId === socket?.id;

    return {
        tubeState,
        receivedAt,
        updateTubeState,
        isOwner
    };
}
