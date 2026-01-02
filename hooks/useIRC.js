"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/lib/socket";

/**
 * useIRC - Passive hook that syncs with the server's IRC bridge (HistoryBot)
 * instead of connecting its own client (to avoid duplicate connections/G-lines).
 */
export function useIRC(user) {
    const [ircUsers, setIrcUsers] = useState(new Map());
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket) return;

        console.log("[useIRC] 🎧 Listening for server-side IRC events...");

        // Handle full userlist sync
        const handleUserlist = (event) => {
            console.log(`[useIRC] 📋 Syncing userlist (${event.users.length} users)`);
            const userMap = new Map();
            event.users.forEach(u => {
                userMap.set(u.nick, {
                    name: u.nick,
                    isIRC: true,
                    modes: u.modes,
                    avatar: `/api/avatar/${u.nick}`
                });
            });
            setIrcUsers(userMap);
        };

        // Handle single user joining
        const handleUserJoined = (event) => {
            console.log(`[useIRC] 👤 ${event.nick} joined IRC`);
            setIrcUsers(prev => {
                const next = new Map(prev);
                next.set(event.nick, {
                    name: event.nick,
                    isIRC: true,
                    modes: [],
                    avatar: `/api/avatar/${event.nick}`
                });
                return next;
            });
        };

        // Handle user leaving
        const handleUserLeft = (event) => {
            console.log(`[useIRC] 🚪 ${event.nick} left IRC`);
            setIrcUsers(prev => {
                const next = new Map(prev);
                next.delete(event.nick);
                return next;
            });
        };

        // Handle nick change
        const handleNickChange = (event) => {
            console.log(`[useIRC] 🏷️ ${event.oldNick} -> ${event.newNick}`);
            setIrcUsers(prev => {
                const next = new Map(prev);
                const userData = next.get(event.oldNick);
                if (userData) {
                    next.delete(event.oldNick);
                    next.set(event.newNick, { ...userData, name: event.newNick, avatar: `/api/avatar/${event.newNick}` });
                }
                return next;
            });
        };

        socket.on('irc-userlist', handleUserlist);
        socket.on('irc-user-joined', handleUserJoined);
        socket.on('irc-user-left', handleUserLeft);
        socket.on('irc-nick-change', handleNickChange);

        return () => {
            socket.off('irc-userlist', handleUserlist);
            socket.off('irc-user-joined', handleUserJoined);
            socket.off('irc-user-left', handleUserLeft);
            socket.off('irc-nick-change', handleNickChange);
        };
    }, [socket]);

    const sendMessage = useCallback((text) => {
        if (socket && isConnected) {
            socket.emit('irc-message', { text });
        }
    }, [socket, isConnected]);

    return {
        ircUsers,
        isConnected,
        sendMessage,
        error: null
    };
}
