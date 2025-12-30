import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/lib/socket';

export function useYouTubeSync(roomId, user) {
    const { socket } = useSocket();
    const [receivedAt, setReceivedAt] = useState(Date.now());
    const [tubeState, setTubeState] = useState({
        videoId: null,
        isPlaying: false,
        timestamp: 0,
        lastUpdate: 0,
        ownerId: null
    });

    // Listen for updates from server
    useEffect(() => {
        if (!socket) return;

        const handleStateUpdate = (newState) => {
            // console.log("TUBE: Received state", newState);
            setTubeState(newState);
            setReceivedAt(Date.now());
        };

        socket.on('tube-state', handleStateUpdate);

        // Request initial state on join
        socket.emit('tube-request-state', { roomId });

        return () => {
            socket.off('tube-state', handleStateUpdate);
        };
    }, [socket, roomId]);

    // Function to broadcast updates
    const updateTubeState = useCallback((partialState) => {
        if (!socket) return;

        const newState = {
            ...partialState,
            ownerId: socket.id
        };

        // OPTIMISTIC UPDATE: 
        // We update locally for UI responsiveness, but we NEVER update lastUpdate here.
        // We MUST wait for the server's echoed lastUpdate to maintain sync math.
        setTubeState(prev => ({ ...prev, ...newState }));

        socket.emit('tube-update', {
            roomId,
            ...newState,
            timestamp: newState.timestamp !== undefined ? newState.timestamp : tubeState.timestamp
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
