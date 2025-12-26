"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/lib/socket";

export function useIRC() {
    const { socket, isConnected } = useSocket();
    const [ircUsers, setIrcUsers] = useState(new Map());

    useEffect(() => {
        if (!socket || !isConnected) return;

        // Handle full user list
        const handleUserList = ({ channel, users }) => {
            // users is array of { nick, modes }
            const userMap = new Map();
            users.forEach((u) => {
                userMap.set(u.nick, { name: u.nick, isIRC: true, modes: u.modes });
            });
            setIrcUsers(userMap);
        };

        // Handle single user join
        const handleUserJoined = ({ nick, channel }) => {
            setIrcUsers((prev) => {
                const next = new Map(prev);
                next.set(nick, { name: nick, isIRC: true });
                return next;
            });
        };

        // Handle single user left
        const handleUserLeft = ({ nick, channel }) => {
            setIrcUsers((prev) => {
                const next = new Map(prev);
                next.delete(nick);
                return next;
            });
        };

        // Handle nick change
        const handleNickChange = ({ oldNick, newNick }) => {
            setIrcUsers((prev) => {
                const next = new Map(prev);
                const userData = next.get(oldNick);
                if (userData) {
                    next.delete(oldNick);
                    next.set(newNick, { ...userData, name: newNick });
                }
                return next;
            });
        };

        socket.on("irc-userlist", handleUserList);
        socket.on("irc-user-joined", handleUserJoined);
        socket.on("irc-user-left", handleUserLeft);
        socket.on("irc-nick-change", handleNickChange);

        return () => {
            socket.off("irc-userlist", handleUserList);
            socket.off("irc-user-joined", handleUserJoined);
            socket.off("irc-user-left", handleUserLeft);
            socket.off("irc-nick-change", handleNickChange);
        };
    }, [socket, isConnected]);

    return {
        ircUsers,
    };
}
