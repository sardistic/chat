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
                // Google STUN servers (Default)
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },

                // ⚠️ IMPORTANT FOR MOBILE/CELL NETWORKS ⚠️
                // You need a TURN server to separate NATs (like cell phones).
                // Get free credentials from: https://www.metered.ca/tools/openrelay/
                // {
                //   urls: 'turn:openrelay.metered.ca:80',
                //   username: 'openrelayproject',
                //   credential: 'openrelayproject'
                // },
                // {
                //   urls: 'turn:openrelay.metered.ca:443',
                //   username: 'openrelayproject',
                //   credential: 'openrelayproject'
                // },
                // {
                //   urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                //   username: 'openrelayproject',
                //   credential: 'openrelayproject'
                // }
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
            // If we don't have a peer yet, create one (not as initiator)
            peer = this.createPeer(peerId, false);
        }

        try {
            peer.signal(signal);
        } catch (err) {
            console.error(`Error handling signal from ${peerId}:`, err);
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
        this.localStream = newStream;

        // Replace tracks for all existing peers
        this.peers.forEach((peer) => {
            try {
                // Remove old tracks
                peer.removeStream(this.localStream);
                // Add new tracks
                peer.addStream(newStream);
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
