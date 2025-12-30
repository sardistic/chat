import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/lib/socket';

export function useYouTubeSync(roomId, user) {
    const { socket } = useSocket();
    const [tubeState, setTubeState] = useState({
        videoId: null,
        isPlaying: false,
        timestamp: 0,
        lastUpdate: 0
    });

    // Listen for updates from server
    useEffect(() => {
        if (!socket) return;

        const handleStateUpdate = (newState) => {
            // console.log("TUBE: Received state", newState);
            setTubeState(newState);
        };

        socket.on('tube-state', handleStateUpdate);

        // Request initial state on join
        socket.emit('tube-request-state', { roomId });

        return () => {
            socket.off('tube-state', handleStateUpdate);
        };
    }, [socket, roomId]);

    // Function to broadcast updates (only if allowed)
    const updateTubeState = useCallback((partialState) => {
        if (!socket) return;

        // Optimistic update? Maybe safer to wait for echo, but players feel laggy without it.
        // Let's do optimistic.
        setTubeState(prev => ({ ...prev, ...partialState, lastUpdate: Date.now() }));

        socket.emit('tube-update', {
            roomId,
            ...partialState,
            timestamp: partialState.timestamp || tubeState.timestamp, // Ensure we send current time if updating play status
            lastUpdate: Date.now()
        });
    }, [socket, roomId, tubeState]);

    return {
        tubeState,
        updateTubeState,
        isOwner: true // For now, everyone is owner/can control. Later: check user.isAdmin
    };
}
