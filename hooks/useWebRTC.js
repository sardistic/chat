"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSocket } from '@/lib/socket';
import { PeerManager } from '@/lib/webrtc';

export function useWebRTC(roomId, user, autoStart = true) {
    const { socket, isConnected } = useSocket();
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers] = useState(new Map());
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [error, setError] = useState(null);
    const [iceConfig, setIceConfig] = useState(null); // Store ICE config

    const peerManagerRef = useRef(null);
    const localStreamRef = useRef(null);
    const hasJoinedRoom = useRef(false);
    const userRef = useRef(user);

    // Initialize local media stream
    const initializeMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            localStreamRef.current = stream;
            setLocalStream(stream);
            setError(null);
            return stream;
        } catch (err) {
            console.error('Error accessing media devices:', err);
            setError('Failed to access camera/microphone. Please grant permissions.');
            throw err;
        }
    }, []);

    // Fetch ICE servers from Metered.ca
    useEffect(() => {
        const fetchIceServers = async () => {
            try {
                // Using the API key provided in the screenshot
                const apiKey = "fafec8b0be0282c0d3e36562d8b94b576488";
                const response = await fetch(`https://sardistic.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`);
                if (!response.ok) throw new Error('Failed to fetch TURN credentials');
                const iceServers = await response.json();
                console.log('✅ Loaded TURN credentials from Metered.ca');
                setIceConfig({ iceServers });
            } catch (err) {
                console.warn('⚠️ Failed to load TURN servers, connectivity on mobile may fail:', err);
                // Fallback to default STUN provided in PeerManager
            }
        };
        fetchIceServers();
    }, []);

    // Start broadcasting
    const startBroadcast = useCallback(async () => {
        try {
            console.log('📹 Starting broadcast...');
            console.log('   Current peers:', peers.size, Array.from(peers.keys()));
            console.log('   PeerManager exists:', !!peerManagerRef.current);
            const stream = await initializeMedia();

            if (peerManagerRef.current) {
                console.log('🔄 Updating existing peer connections with new stream');
                // Update existing peer connections with new stream
                peerManagerRef.current.updateLocalStream(stream);

                // Check for any peers we aren't connected to yet and connect
                const activePeers = peerManagerRef.current.getPeerIds();
                peers.forEach((peerData, peerId) => {
                    if (!activePeers.includes(peerId)) {
                        console.log('➕ Connecting to new peer during broadcast:', peerId);
                        peerManagerRef.current.createPeer(peerId, true);
                    }
                });
            } else {
                console.log('🆕 Creating new PeerManager');
                // Create peer manager
                console.log('🆕 Creating new PeerManager');
                // Create peer manager
                const peerManager = new PeerManager(socket, stream, iceConfig);
                peerManagerRef.current = peerManager;

                // Handle new peer streams
                peerManager.onStream((peerId, stream) => {
                    console.log('📺 Received stream from peer:', peerId);
                    setPeers(prev => {
                        const newPeers = new Map(prev);
                        const existingPeer = prev.get(peerId) || {};
                        // Preserve existing user data when adding stream
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

                // CRITICAL: Create peer connections for all existing users
                // Use the current peers Map directly to avoid duplicate calls
                console.log('🔗 Creating peer connections for existing users:', peers.size);
                if (peers.size > 0) {
                    peers.forEach((peerData, peerId) => {
                        console.log('  → Creating peer for:', peerId, peerData.user?.name);
                        peerManager.createPeer(peerId, true);
                    });
                } else {
                    console.log('  ⚠️ No existing peers to connect to');
                }
            }

            console.log('✅ Broadcast started successfully');
            return stream;
        } catch (err) {
            console.error('Error starting broadcast:', err);
            setError('Failed to start camera');
            throw err;
        }
    }, [socket, initializeMedia, peers]);

    // Stop broadcasting
    const stopBroadcast = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
    }, []);

    // Toggle audio
    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    }, []);

    // Toggle video
    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    }, []);

    // Leave room and cleanup
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

    // Update user ref when user changes
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Join room and set up event listeners
    useEffect(() => {
        console.log('🔍 useEffect triggered:', {
            hasSocket: !!socket,
            isConnected,
            roomId,
            hasUser: !!userRef.current,
            hasJoined: hasJoinedRoom.current
        });

        if (!socket || !isConnected || !roomId || !userRef.current || hasJoinedRoom.current) {
            console.log('⏭️ Skipping room join:', {
                reason: !socket ? 'no socket' : !isConnected ? 'not connected' : !roomId ? 'no roomId' : !userRef.current ? 'no user' : 'already joined'
            });
            return;
        }

        const currentUser = userRef.current;
        console.log('🚀 Joining room:', roomId, 'as', currentUser.name);

        // Set up event listeners BEFORE joining room
        const handleUserJoined = ({ socketId, user: joinedUser }) => {
            console.log(`👋 User ${joinedUser.name} joined (${socketId})`);

            setPeers(prev => {
                const newPeers = new Map(prev);
                newPeers.set(socketId, { stream: null, userId: socketId, user: joinedUser });
                console.log('📊 Total users now:', newPeers.size + 1);
                return newPeers;
            });

            if (peerManagerRef.current) {
                peerManagerRef.current.createPeer(socketId, true);
            }
        };

        const handleExistingUsers = ({ users }) => {
            console.log(`📋 Existing users in room:`, users);

            setPeers(prev => {
                const newPeers = new Map(prev);
                users.forEach(({ socketId, user: existingUser }) => {
                    if (socketId !== socket.id) {
                        newPeers.set(socketId, { stream: null, userId: socketId, user: existingUser });
                    }
                });
                console.log('📊 Total users now:', newPeers.size + 1);
                return newPeers;
            });

            if (peerManagerRef.current) {
                users.forEach(({ socketId }) => {
                    if (socketId !== socket.id) {
                        peerManagerRef.current.createPeer(socketId, false);
                    }
                });
            }
        };

        const handleSignal = ({ sender, payload }) => {
            console.log('📶 Received signal from:', sender);

            // If we don't have a PeerManager yet, create one (without local stream)
            // This allows us to receive streams even if we're not broadcasting
            if (!peerManagerRef.current) {
                console.log('  🆕 Creating PeerManager to receive stream (not broadcasting)');
                const peerManager = new PeerManager(socket, null, iceConfig);
                peerManagerRef.current = peerManager;

                // Handle incoming streams
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

            peerManagerRef.current.handleSignal(sender, payload);
        };

        const handleUserLeft = ({ socketId }) => {
            console.log(`👋 User ${socketId} left`);

            setPeers(prev => {
                const newPeers = new Map(prev);
                newPeers.delete(socketId);
                console.log('📊 Total users now:', newPeers.size + 1);
                return newPeers;
            });

            if (peerManagerRef.current) {
                peerManagerRef.current.destroyPeer(socketId);
            }
        };

        // Register all event listeners
        console.log('📡 Registering socket event listeners...');
        socket.on('user-joined', handleUserJoined);
        socket.on('existing-users', handleExistingUsers);
        socket.on('signal', handleSignal);
        socket.on('user-left', handleUserLeft);
        console.log('✅ Socket event listeners registered');

        // NOW join the room (after listeners are set up)
        console.log('📤 Emitting join-room event with:', { roomId, user: currentUser });
        socket.emit('join-room', { roomId, user: currentUser });
        hasJoinedRoom.current = true;
        console.log('✅ join-room event emitted');

        // Cleanup listeners on unmount or re-run
        return () => {
            console.log('🧹 Cleaning up socket listeners');
            socket.off('user-joined', handleUserJoined);
            socket.off('existing-users', handleExistingUsers);
            socket.off('signal', handleSignal);
            socket.off('user-left', handleUserLeft);

            // Optionally leave room?
            // socket.emit('leave-room', roomId); 
            // We generally want to stay in room if just re-rendering, but strict mode unmounts.
            // If we leave, we must rejoin. 
        };
    }, [socket, isConnected, roomId]);

    // Auto-start camera if enabled
    useEffect(() => {
        if (autoStart && socket && isConnected && roomId && user) {
            startBroadcast();
        }
    }, [autoStart, socket, isConnected, roomId, user?.name, startBroadcast]);

    return {
        localStream,
        peers,
        isAudioEnabled,
        isVideoEnabled,
        toggleAudio,
        toggleVideo,
        startBroadcast,
        stopBroadcast,
        leaveRoom,
        error,
    };
}
