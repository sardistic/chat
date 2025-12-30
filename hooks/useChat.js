"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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

        const handleMessage = (message) => {
            // Check if we've already seen this message (fast Set lookup)
            if (seenIdsRef.current.has(message.id)) {
                return; // Skip duplicate
            }

            // Mark as seen
            seenIdsRef.current.add(message.id);

            // Add to messages
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

        const handleHistory = (history) => {
            setMessages(history);
        };

        socket.on('chat-message', handleMessage);
        socket.on('chat-history', handleHistory);
        socket.on('user-typing', handleUserTyping);
        socket.on('user-stop-typing', handleUserStopTyping);

        return () => {
            socket.off('chat-message', handleMessage);
            socket.off('chat-history', handleHistory);
            socket.off('user-typing', handleUserTyping);
            socket.off('user-stop-typing', handleUserStopTyping);

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [socket, isConnected, user]);

    return {
        messages,
        sendMessage,
        handleTyping,
        typingUsers: Array.from(typingUsers),
        isTyping
    };
}
