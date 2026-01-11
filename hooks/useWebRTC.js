"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSocket } from '@/lib/socket';
import { PeerManager } from '@/lib/webrtc';

export function useWebRTC(roomId, user, autoStart = true) {
    const { socket, isConnected } = useSocket();
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers] = useState(new Map());
    const [isAudioEnabled, setIsAudioEnabled] = useState(false); // Default mute
    const [isVideoEnabled, setIsVideoEnabled] = useState(false); // Default video off (until start)
    const [isDeafened, setIsDeafened] = useState(true); // Default deafened requested by user
    const [error, setError] = useState(null);

    const peerManagerRef = useRef(null);
    const localStreamRef = useRef(null);
    const hasJoinedRoom = useRef(false);
    const userRef = useRef(user);

    // NOTE: initializeMedia removed - getUserMedia is now called directly in startBroadcast
    // to ensure it happens immediately in the user gesture context

    // Helper: Broadcast Status
    const broadcastStatus = useCallback((status) => {
        if (socket && isConnected) {
            console.log('📡 Broadcasting status update:', status);
            socket.emit('update-user', status);
        }
    }, [socket, isConnected]);

    // Start broadcasting - receives stream from caller (who handles getUserMedia in click context)
    const startBroadcast = useCallback(async (stream) => {
        console.log('📹 Starting broadcast with provided stream...');

        if (!stream) {
            const err = new Error('No stream provided to startBroadcast');
            setError(err.message);
            throw err;
        }

        try {
            // Enforce initial mute state
            stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });

            localStreamRef.current = stream;
            setLocalStream(stream);

            // 2. Set State
            setIsVideoEnabled(true);
            setIsAudioEnabled(false); // Start muted by default

            // 3. Broadcast Status
            broadcastStatus({
                isVideoEnabled: true,
                isAudioEnabled: false,
                isDeafened
            });

            // 4. Update PeerManager
            if (peerManagerRef.current) {
                console.log('🔄 Updating existing peer connections with new stream (Soft Reconnect)');

                // Update existing peers with new stream
                // NOTE: This method internally updates this.localStream, so we must NOT set it manually beforehand
                // or else 'oldStream' will be incorrect and removeStream will fail.
                peerManagerRef.current.updateLocalStream(stream);

                console.log('DEBUG: PeerManager Peers:', Array.from(peerManagerRef.current.peers.keys()));
                console.log('DEBUG: React State Peers:', Array.from(peers.keys()));

                // Connect to any valid peers we missed (e.g. they were silent when we joined)
                peers.forEach((peerData, peerId) => {
                    if (peerId !== socket.id && !peerManagerRef.current.peers.has(peerId)) {
                        console.log('📡 Connecting to existing silent peer:', peerId);
                        peerManagerRef.current.createPeer(peerId, true);
                    }
                });
            } else {
                console.log('🆕 Creating new PeerManager');
                const peerManager = new PeerManager(socket, stream);
                peerManagerRef.current = peerManager;

                // Handle new peer streams
                peerManager.onStream((peerId, stream) => {
                    console.log('📺 Received stream from peer:', peerId);
                    setPeers(prev => {
                        const newPeers = new Map(prev);
                        const existingPeer = prev.get(peerId) || {};
                        // Optimistically set isVideoEnabled to true since we received a stream
                        const updatedUser = { ...(existingPeer.user || {}), isVideoEnabled: true };
                        newPeers.set(peerId, { ...existingPeer, stream, user: updatedUser, userId: peerId });
                        return newPeers;
                    });
                });

                // Handle peer leaving
                peerManager.onPeerLeft((peerId) => {
                    setPeers(prev => {
                        const newPeers = new Map(prev);
                        newPeers.delete(peerId);
                        return newPeers;
                    });
                });

                // Connect to ALL peers
                peers.forEach((peerData, peerId) => {
                    if (peerId !== socket.id) {
                        console.log('📡 Connecting to existing peer (fresh broadcast):', peerId);
                        peerManager.createPeer(peerId, true);
                    }
                });
            }

            console.log('✅ Broadcast started successfully');
            return stream;
        } catch (err) {
            console.error('Error starting broadcast:', err);
            setError('Failed to start camera');
            throw err;
        }
    }, [socket, peers, broadcastStatus, isDeafened]);

    // Stop broadcasting
    const stopBroadcast = useCallback(() => {
        console.log('🛑 Stopping broadcast...');

        // 1. Notify peers to remove stream
        try {
            if (peerManagerRef.current) {
                peerManagerRef.current.stopLocalStream();
            }
        } catch (err) {
            console.error("Error stopping local stream on peers:", err);
        }

        // 2. Stop tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                try { track.stop(); } catch (e) { }
            });
            localStreamRef.current = null;
            setLocalStream(null);
        }

        // 3. Reset State & Broadcast
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        broadcastStatus({
            isVideoEnabled: false,
            isAudioEnabled: false,
            isDeafened
        });

    }, [broadcastStatus, isDeafened]);

    // Toggle audio
    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                const newState = !audioTrack.enabled;
                audioTrack.enabled = newState;
                setIsAudioEnabled(newState);
                broadcastStatus({ isAudioEnabled: newState });
            }
        }
    }, [broadcastStatus]);

    // Toggle video (Internal or Helper)
    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                const newState = !videoTrack.enabled;
                videoTrack.enabled = newState;
                setIsVideoEnabled(newState);
                broadcastStatus({ isVideoEnabled: newState });
            }
        }
    }, [broadcastStatus]);

    // Toggle Deaf
    const toggleDeaf = useCallback(() => {
        setIsDeafened(prev => {
            const newState = !prev;
            broadcastStatus({ isDeafened: newState });

            // Logic to mute INCOMING audio? 
            // The PeerManager usually handles streams.
            // But we can mute the AUDIO ELEMENTS in VideoGrid effectively by the flag.
            // Or we should iterate peers and mute them here?
            // For now, we rely on VideoGrid checking `isDeafened` prop or this hook state if passed down?
            // Actually, `useWebRTC` doesn't control the audio elements directly, VideoGrid does.
            // So broadcasting the state is enough if VideoGrid uses it for UI. 
            // BUT for actual functionality, VideoGrid should mute the <video> or <audio> tags.

            return newState;
        });
    }, [broadcastStatus]);

    // Leave room
    const leaveRoom = useCallback(() => {
        if (peerManagerRef.current) {
            peerManagerRef.current.destroyAll();
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
        setPeers(new Map());
        if (socket) {
            socket.emit('leave-room', roomId);
        }
        hasJoinedRoom.current = false;
    }, [socket, roomId]);

    // Update user Ref
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Main Socket Logic
    useEffect(() => {
        if (!socket || !isConnected || !roomId || !userRef.current || hasJoinedRoom.current) return;

        const currentUser = userRef.current;
        console.log('🚀 Joining room:', roomId, 'as', currentUser.name);

        // --- Handlers ---

        const handleUserJoined = ({ socketId, user: joinedUser }) => {
            console.log(`👋 User ${joinedUser.name} joined (${socketId})`);
            setPeers(prev => {
                const newPeers = new Map(prev);
                newPeers.set(socketId, { stream: null, userId: socketId, user: joinedUser });
                return newPeers;
            });

            // If we are broadcasting, connect to the new user immediately
            if (peerManagerRef.current && localStreamRef.current) {
                console.log(`📹 Auto-connecting to new user ${socketId} as broadcaster`);
                peerManagerRef.current.createPeer(socketId, true);
            }
        };

        const handleExistingUsers = ({ users }) => {
            console.log(`📋 Existing users:`, users);
            const broadcastingPeers = [];
            setPeers(prev => {
                const newPeers = new Map(prev);
                users.forEach(({ socketId, user: existingUser }) => {
                    if (socketId !== socket.id) {
                        newPeers.set(socketId, { stream: null, userId: socketId, user: existingUser });
                        // Track users who are broadcasting
                        if (existingUser.isVideoEnabled) {
                            broadcastingPeers.push(socketId);
                        }
                    }
                });
                return newPeers;
            });

            // Create peer connections to users who are broadcasting
            setTimeout(() => {
                if (peerManagerRef.current && broadcastingPeers.length > 0) {
                    console.log('📡 Creating connections to broadcasting users:', broadcastingPeers);
                    broadcastingPeers.forEach(peerId => {
                        if (!peerManagerRef.current.peers.has(peerId)) {
                            peerManagerRef.current.createPeer(peerId, false); // We are the receiver
                        }
                    });
                }
            }, 100);
        };

        const handleUserUpdated = ({ socketId, user: updatedUser }) => {
            console.log(`🔄 User updated: ${updatedUser.name} (${socketId})`, updatedUser);
            setPeers(prev => {
                const newPeers = new Map(prev);
                const existing = newPeers.get(socketId);
                if (existing) {
                    newPeers.set(socketId, { ...existing, user: updatedUser });
                }
                return newPeers;
            });
        };

        const handleSignal = ({ sender, payload }) => {
            if (peerManagerRef.current) {
                peerManagerRef.current.handleSignal(sender, payload);
            }
        };

        const handleUserLeft = ({ socketId }) => {
            setPeers(prev => {
                const newPeers = new Map(prev);
                newPeers.delete(socketId);
                return newPeers;
            });
            if (peerManagerRef.current) {
                peerManagerRef.current.destroyPeer(socketId);
            }
        };

        const handleConnectToPeer = ({ peerId }) => {
            console.log(`📡 Broadcaster: Connecting to new peer ${peerId}`);
            if (peerManagerRef.current && localStreamRef.current) {
                // Create peer connection as initiator (we have the stream, they want it)
                peerManagerRef.current.createPeer(peerId, true);
            }
        };

        // --- Logic ---

        // Create PeerManager early (even without local stream) so we can receive streams
        if (!peerManagerRef.current) {
            console.log('🆕 Creating PeerManager on room join (receive-only mode)');
            const peerManager = new PeerManager(socket, null);
            peerManagerRef.current = peerManager;

            // Handle new peer streams
            peerManager.onStream((peerId, stream) => {
                console.log('📺 Received stream from peer:', peerId);
                setPeers(prev => {
                    const newPeers = new Map(prev);
                    const existingPeer = prev.get(peerId) || {};
                    newPeers.set(peerId, { ...existingPeer, stream, userId: peerId });
                    return newPeers;
                });
            });

            // Handle peer leaving
            peerManager.onPeerLeft((peerId) => {
                setPeers(prev => {
                    const newPeers = new Map(prev);
                    newPeers.delete(peerId);
                    return newPeers;
                });
            });
        }

        // JOIN Room
        const { ircConfig, ...safeUser } = currentUser;
        const userWithState = {
            ...safeUser,
            isVideoEnabled: false,
            isAudioEnabled: false,
            isDeafened: true
        };
        socket.emit('join-room', { roomId, user: userWithState, ircConfig });
        hasJoinedRoom.current = true;

        // Request streams from existing broadcasters
        setTimeout(() => {
            socket.emit('request-streams', { roomId });
        }, 500);

        // --- Verify Listeners ---
        socket.on('user-joined', handleUserJoined);
        socket.on('existing-users', handleExistingUsers);
        socket.on('user-updated', handleUserUpdated);
        socket.on('signal', handleSignal);
        socket.on('user-left', handleUserLeft);
        socket.on('connect-to-peer', handleConnectToPeer);

        return () => {
            socket.off('user-joined', handleUserJoined);
            socket.off('existing-users', handleExistingUsers);
            socket.off('user-updated', handleUserUpdated);
            socket.off('signal', handleSignal);
            socket.off('user-left', handleUserLeft);
            socket.off('connect-to-peer', handleConnectToPeer);
            leaveRoom();
        };
    }, [socket, isConnected, roomId]);

    // Auto-start (Disabled mostly, or respects deaf default)
    useEffect(() => {
        if (autoStart && socket && isConnected && roomId && user && !localStream) {
            // If autoStart, we do NOT auto-broadcast usually unless explicit.
            // But if we did, we should respect isDeafened default.
        }
    }, [autoStart, socket, isConnected, roomId, user, localStream]);

    return {
        localStream,
        peers,
        isAudioEnabled,
        isVideoEnabled,
        isDeafened,
        toggleAudio,
        toggleVideo,
        toggleDeaf,
        startBroadcast,
        stopBroadcast,
        leaveRoom,
        error,
    };
}
