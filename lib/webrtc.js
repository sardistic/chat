import SimplePeer from 'simple-peer';

export class PeerManager {
    constructor(socket, localStream, config = null) {
        this.socket = socket;
        this.localStream = localStream;
        this.peers = new Map(); // Map of socketId -> SimplePeer instance
        this.streams = new Map(); // Map of socketId -> MediaStream
        this.onStreamCallback = null;
        this.onPeerLeftCallback = null;
        this.config = config || {
            iceServers: [
                { urls: "stun:stun.relay.metered.ca:80" },
                { urls: "turn:standard.relay.metered.ca:80", username: "3072a2e739678b28c5cd4a1e", credential: "v567OBHEj0q8ejUr" },
                { urls: "turn:standard.relay.metered.ca:80?transport=tcp", username: "3072a2e739678b28c5cd4a1e", credential: "v567OBHEj0q8ejUr" },
                { urls: "turn:standard.relay.metered.ca:443", username: "3072a2e739678b28c5cd4a1e", credential: "v567OBHEj0q8ejUr" },
                { urls: "turns:standard.relay.metered.ca:443?transport=tcp", username: "3072a2e739678b28c5cd4a1e", credential: "v567OBHEj0q8ejUr" },
                { urls: "stun:stun.l.google.com:19302" }
            ],
        };
    }

    // Set callback for when a new stream is received
    onStream(callback) {
        this.onStreamCallback = callback;
    }

    // Set callback for when a peer leaves
    onPeerLeft(callback) {
        this.onPeerLeftCallback = callback;
    }

    // Create a new peer connection
    createPeer(peerId, initiator = false) {
        if (this.peers.has(peerId)) {
            console.log(`Peer ${peerId} already exists, destroying old one`);
            this.destroyPeer(peerId);
        }

        const peer = new SimplePeer({
            initiator,
            stream: this.localStream,
            trickle: true,
            config: this.config,
        });

        // Handle signaling data
        peer.on('signal', (data) => {
            this.socket.emit('signal', {
                target: peerId,
                payload: data,
            });
        });

        // Log ICE state changes for debugging
        if (peer._pc) {
            peer._pc.oniceconnectionstatechange = () => {
                console.log(`🧊 ICE State (${peerId}):`, peer._pc.iceConnectionState);
            };
        }

        // Handle connection event
        peer.on('connect', () => {
            console.log(`✅ Peer connected: ${peerId}`);
        });
        // Handle incoming stream
        peer.on('stream', (stream) => {
            console.log(`Received stream from peer ${peerId}`);
            this.streams.set(peerId, stream);
            if (this.onStreamCallback) {
                this.onStreamCallback(peerId, stream);
            }
        });

        // Handle errors
        peer.on('error', (err) => {
            console.error(`Peer error with ${peerId}:`, err);
            this.destroyPeer(peerId);
        });

        // Handle connection close
        peer.on('close', () => {
            console.log(`Peer connection closed with ${peerId}`);
            this.destroyPeer(peerId);
        });

        this.peers.set(peerId, peer);
        return peer;
    }

    // Handle incoming signal from another peer
    handleSignal(peerId, signal) {
        let peer = this.peers.get(peerId);

        if (!peer) {
            console.log(`  Unknown peer ${peerId}, creating new receiver`);
            peer = this.createPeer(peerId, false);
        }

        try {
            peer.signal(signal);
        } catch (err) {
            // Ignore InvalidStateError which happens when we receive duplicate signals/answers
            // for a connection that is already stable.
            if (err.code === 'ERR_DATA_CHANNEL' || err.name === 'InvalidStateError' || err.message.includes('wrong state')) {
                console.warn(`⚠️ Ignoring duplicate/invalid signal from ${peerId} (Connection likely stable):`, err.message);
            } else {
                console.error(`❌ Error processing signal from ${peerId}:`, err);
                // Don't re-throw, keep the peer alive if possible
            }
        }
    }

    // Destroy a specific peer connection
    destroyPeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            try {
                peer.destroy();
            } catch (err) {
                console.error(`Error destroying peer ${peerId}:`, err);
            }
            this.peers.delete(peerId);
        }

        if (this.streams.has(peerId)) {
            this.streams.delete(peerId);
            if (this.onPeerLeftCallback) {
                this.onPeerLeftCallback(peerId);
            }
        }
    }

    // Destroy all peer connections
    destroyAll() {
        this.peers.forEach((peer, peerId) => {
            this.destroyPeer(peerId);
        });
        this.peers.clear();
        this.streams.clear();
    }

    // Update local stream (e.g., when toggling video/audio)
    updateLocalStream(newStream) {
        const oldStream = this.localStream;
        this.localStream = newStream;

        // Replace tracks for all existing peers
        this.peers.forEach((peer) => {
            try {
                // Remove old tracks if they exist
                if (oldStream) {
                    peer.removeStream(oldStream);
                }
                // Add new tracks
                if (newStream) {
                    peer.addStream(newStream);
                }
            } catch (err) {
                console.error('Error updating stream:', err);
            }
        });
    }

    // Get all active peer IDs
    getPeerIds() {
        return Array.from(this.peers.keys());
    }

    // Get stream for a specific peer
    getStream(peerId) {
        return this.streams.get(peerId);
    }
}
