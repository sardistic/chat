"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from '@/lib/socket';

export function useChat(roomId, user) {
    const { socket, isConnected } = useSocket();
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const typingTimeoutRef = useRef(null);

    // Track seen message IDs to prevent duplicates
    const seenIdsRef = useRef(new Set());

    // Send a message
    const sendMessage = useCallback((text) => {
        if (!socket || !text.trim() || !roomId || !user) return;

        const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const message = {
            id: messageId,
            roomId,
            text: text.trim(),
            sender: user.name,
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

        const handleMessage = (message) => {
            if (seenIdsRef.current.has(message.id)) {
                console.log('🛑 Ignored duplicate:', message.id);
                return;
            }
            console.log('📥 Received:', message.id, message.text);
            seenIdsRef.current.add(message.id);
            setMessages(prev => [...prev, message]);
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
                if (!idsInBatch.has(msg.id)) {
                    idsInBatch.add(msg.id);
                    uniqueHistory.push(msg);
                    seenIdsRef.current.add(msg.id);
                }
            });

            setMessages(uniqueHistory);
        };

        const handleUpdate = (updatedMsg) => {
            console.log('🔄 Update received:', updatedMsg.id);
            setMessages(prev => {
                const exists = prev.some(m => m.id === updatedMsg.id);
                if (!exists) {
                    // If we don't have it, add it (upsert)
                    // This handles the "missed join" case
                    seenIdsRef.current.add(updatedMsg.id);
                    return [...prev, updatedMsg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                }
                return prev.map(m => m.id === updatedMsg.id ? updatedMsg : m);
            });
        };

        socket.on('chat-message', handleMessage);
        socket.on('chat-history', handleHistory);
        socket.on('chat-message-update', handleUpdate);
        socket.on('user-typing', handleUserTyping);
        socket.on('user-stop-typing', handleUserStopTyping);

        // Request history manually to ensure we get it even if listeners attached late
        if (roomId) {
            console.log('📜 Requesting history for:', roomId);
            socket.emit('get-history', { roomId });
        }

        return () => {
            socket.off('chat-message', handleMessage);
            socket.off('chat-history', handleHistory);
            socket.off('chat-message-update', handleUpdate);
            socket.off('user-typing', handleUserTyping);
            socket.off('user-stop-typing', handleUserStopTyping);

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
        isTyping
    };
}
