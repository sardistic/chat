"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from '@/lib/socket';

export function useChat(roomId, user) {
    const { socket, isConnected } = useSocket();
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [isBuilding, setIsBuilding] = useState(false);
    const typingTimeoutRef = useRef(null);

    // Blocking State
    const [blockedIds, setBlockedIds] = useState(new Set());
    useEffect(() => {
        if (user?.id) {
            fetch('/api/user/block').then(res => res.json()).then(ids => {
                if (Array.isArray(ids)) setBlockedIds(new Set(ids));
            }).catch(e => console.error("Failed to load blocks", e));
        }
    }, [user?.id]);

    // Track seen message IDs to prevent duplicates
    const seenIdsRef = useRef(new Set());
    const messagesRef = useRef([]);
    const hasRequestedHistoryRef = useRef(false); // Prevent duplicate history requests

    // Send a message
    const sendMessage = useCallback((text) => {
        if (!socket || !text.trim() || !roomId || !user) return;

        const trimmedText = text.trim();

        // Handle /nick command
        if (trimmedText.toLowerCase().startsWith('/nick ')) {
            const newNick = trimmedText.slice(6).trim();
            if (newNick.length > 0 && newNick.length <= 32) {
                // Sanitize nickname (alphanumeric, underscores, no spaces at start/end)
                const sanitizedNick = newNick.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
                if (sanitizedNick.length > 0) {
                    socket.emit('change-nick', { newNick: sanitizedNick });
                    console.log(`[Nick] Changing nickname to: ${sanitizedNick}`);
                    return; // Don't send as regular message
                }
            }
            console.warn('[Nick] Invalid nickname - must be 1-32 alphanumeric characters');
            return;
        }

        const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const message = {
            id: messageId,
            roomId,
            text: trimmedText,
            sender: user.name,
            senderId: user.id, // Critical for blocking
            senderColor: user.color,
            senderAvatar: user.avatar || user.image || `/api/avatar/${user.name}`,
            timestamp: new Date().toISOString(),
        };

        // Add message to local state immediately (optimistic update)
        setMessages(prev => [...prev, message]);

        // Mark as seen so server echo doesn't duplicate
        seenIdsRef.current.add(messageId);

        socket.emit('chat-message', message);

        // Stop typing indicator
        setIsTyping(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        socket.emit('stop-typing', { roomId });
    }, [socket, roomId, user]);


    // Handle typing indicator
    const handleTyping = useCallback(() => {
        if (!socket || !roomId || !user) return;

        if (!isTyping) {
            setIsTyping(true);
            socket.emit('typing', { roomId, user: user.name });
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout to stop typing after 2 seconds
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit('stop-typing', { roomId });
        }, 2000);
    }, [socket, roomId, user, isTyping]);

    // Listen for messages and typing indicators
    useEffect(() => {
        if (!socket || !isConnected) return;

        if (socket.hasListeners('chat-message')) {
            // console.warn('⚠️ useChat: socket already has listeners');
        }

        const handleMessage = (msg) => {
            // 1. Strict Deduplication (ID mismatch)
            if (seenIdsRef.current.has(msg.id)) {
                return;
            }

            // 1.5 Block Filtering
            if (msg.senderId && blockedIds.has(msg.senderId)) {
                console.log(`🚫 Blocked message from ${msg.sender}`);
                return;
            }

            // Global Build State Tracking
            if (msg.systemType === 'deploy-start') setIsBuilding(true);
            if (msg.systemType === 'deploy-success' || msg.systemType === 'deploy-fail') setIsBuilding(false);

            // 2. Client-Side Duplicate Suppression for IRC Echoes
            if (user && msg.sender === user.name && msg.source === 'irc') {
                console.log(`🛡️ Suppressed self-echo from IRC: ${msg.id}`);
                seenIdsRef.current.add(msg.id);
                return;
            }

            // 3. Fuzzy Deduplication (Sender + Text + Time Window)
            // Prevents "same message, different ID" (e.g. Web ID vs IRC ID race)
            const isFuzzyDuplicate = messagesRef.current.some(existing => {
                const timeDiff = Math.abs(new Date(existing.timestamp) - new Date(msg.timestamp));
                const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                const match = normalize(existing.sender) === normalize(msg.sender) &&
                    existing.text === msg.text &&
                    timeDiff < 2000;

                if (match) console.log(`[FuzzyDebug] MATCH FOUND: ${msg.text} | Existing: ${existing.sender} | New: ${msg.sender}`);
                return match;
            });

            if (isFuzzyDuplicate) {
                console.log(`🛡️ Suppressed fuzzy duplicate: ${msg.id} (${msg.text})`);
                seenIdsRef.current.add(msg.id);
                return;
            }

            seenIdsRef.current.add(msg.id);
            messagesRef.current.push(msg); // Keep ref synced for immediate checks
            setMessages((prev) => [...prev, msg]);
        };

        const handleUserTyping = ({ user: typingUser }) => {
            if (typingUser !== user?.name) {
                setTypingUsers(prev => new Set(prev).add(typingUser));
            }
        };

        const handleUserStopTyping = ({ user: typingUser }) => {
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(typingUser);
                return newSet;
            });
        };

        // Duplicate listener prevention
        if (socket.hasListeners('chat-message')) {
            console.warn('⚠️ useChat: socket already has listeners, might be dupe mount');
            // In strict mode, we might want to let it happen if cleanup worked?
            // But if cleanup worked, hasListeners should be false?
            // socket.io doesn't clear listeners on unmount unless we tell it.
        }



        const handleHistory = (history) => {
            console.log('📜 History loaded:', history.length);
            // Deduplicate incoming history against itself and existing seen IDs
            // (Though usually history replaces all, so we just need to ensure the history array itself is unique)
            const uniqueHistory = [];
            const idsInBatch = new Set();

            history.forEach(msg => {
                // 1. Strict ID Check
                if (idsInBatch.has(msg.id)) return;

                // 2. Fuzzy Deduplication (Check against already added messages)
                // Filters out DB duplicates (Same sender, same text, within 3s)
                const isFuzzyDuplicate = uniqueHistory.some(existing => {
                    if (existing.sender !== msg.sender || existing.text !== msg.text) return false;
                    const diff = Math.abs(new Date(existing.timestamp).getTime() - new Date(msg.timestamp).getTime());
                    return diff < 3000;
                });

                if (isFuzzyDuplicate) {
                    // console.log(`🛡️ Suppressed history duplicate: ${msg.text}`);
                    seenIdsRef.current.add(msg.id); // Mark seen
                    return;
                }

                idsInBatch.add(msg.id);
                uniqueHistory.push(msg);
                seenIdsRef.current.add(msg.id);
            });

            setMessages(uniqueHistory);
            messagesRef.current = uniqueHistory;

            // Check history for active build state
            // Find last deployment message
            const lastDeployMsg = [...uniqueHistory].reverse().find(m =>
                ['deploy-start', 'deploy-success', 'deploy-fail'].includes(m.systemType)
            );
            if (lastDeployMsg && lastDeployMsg.systemType === 'deploy-start') {
                setIsBuilding(true);
            } else {
                setIsBuilding(false);
            }
        };

        const handleUpdate = (updatedMsg) => {
            console.log('🔄 Update received:', updatedMsg.id);

            // Global Build State Tracking (Update Case)
            // Fixes bug where animations persist after "Deploy Success" update comes in
            if (updatedMsg.systemType === 'deploy-success' || updatedMsg.systemType === 'deploy-fail') {
                setIsBuilding(false);
            }

            setMessages(prev => {
                // Remove old version if exists, then append at end (so updated bundles appear at bottom)
                const filtered = prev.filter(m => m.id !== updatedMsg.id);
                seenIdsRef.current.add(updatedMsg.id);
                return [...filtered, updatedMsg];
            });
        };

        const handleForceDisconnect = async ({ reason, ban }) => {
            console.warn(`⚠️ Force Disconnected: ${reason}`);
            alert(`You have been disconnected: ${reason}`);

            if (ban) {
                const { signOut } = await import('next-auth/react');
                signOut({ callbackUrl: '/auth/error?error=Banned' });
            } else {
                window.location.href = '/';
            }
        };

        socket.on('chat-message', handleMessage);
        socket.on('chat-history', handleHistory);
        socket.on('chat-message-update', handleUpdate);
        socket.on('user-typing', handleUserTyping);
        socket.on('user-stop-typing', handleUserStopTyping);
        socket.on('force-disconnect', handleForceDisconnect);

        // Request history manually to ensure we get it even if listeners attached late
        // BUT only request ONCE to prevent duplicates
        if (roomId && !hasRequestedHistoryRef.current) {
            console.log('📜 Requesting history for:', roomId);
            hasRequestedHistoryRef.current = true;
            socket.emit('get-history', { roomId });
        }

        return () => {
            socket.off('chat-message', handleMessage);
            socket.off('chat-history', handleHistory);
            socket.off('chat-message-update', handleUpdate);
            socket.off('user-typing', handleUserTyping);
            socket.off('user-stop-typing', handleUserStopTyping);
            socket.off('force-disconnect', handleForceDisconnect);

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [socket, isConnected, user]);

    // Memoize array conversion to prevent effect loops
    const typingUsersList = useMemo(() => Array.from(typingUsers), [typingUsers]);

    return {
        messages,
        sendMessage,
        handleTyping,
        typingUsers: typingUsersList,
        isTyping,
        isBuilding,
        blockedIds // Expose for VideoGrid filtering
    };
}
