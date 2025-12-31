"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useIRC(user) {
    const [ircUsers, setIrcUsers] = useState(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const clientRef = useRef(null);

    useEffect(() => {
        if (!user || !user.name) return;

        // Dynamic import to avoid SSR issues with irc-framework
        let client;

        const connectIRC = async () => {
            try {
                // Determine nickname (sanitize spaces)
                const nick = user.name.replace(/\s+/g, '_').substring(0, 16);
                const channel = '#camrooms';

                console.log(`[IRC] Initializing client for ${nick}...`);

                // Try standard import - bundler should resolve 'browser' field in package.json
                const { Client } = await import('irc-framework');

                client = new Client();
                clientRef.current = client;

                client.connect({
                    nick: nick,
                    username: nick,
                    gecos: 'CamRooms Web Client',

                    // Connect to KiwiIRC's public gateway
                    host: 'kiwiirc.com',
                    port: 443,
                    ssl: true,
                    path: '/webirc/irc.gamesurge.net/6667/',
                    web_socket: true
                });

                client.on('registered', () => {
                    console.log('[IRC] Registered!');
                    setIsConnected(true);
                    client.join(channel);
                });

                client.on('join', (event) => {
                    if (event.nick === client.user.nick) {
                        console.log(`[IRC] Joined ${event.channel}`);
                    }
                    setIrcUsers(prev => {
                        const next = new Map(prev);
                        next.set(event.nick, { name: event.nick, isIRC: true });
                        return next;
                    });
                });

                client.on('part', (event) => {
                    setIrcUsers(prev => {
                        const next = new Map(prev);
                        next.delete(event.nick);
                        return next;
                    });
                });

                client.on('quit', (event) => {
                    setIrcUsers(prev => {
                        const next = new Map(prev);
                        next.delete(event.nick);
                        return next;
                    });
                });

                client.on('nick', (event) => {
                    setIrcUsers(prev => {
                        const next = new Map(prev);
                        const userData = next.get(event.nick);
                        if (userData) {
                            next.delete(event.nick);
                            next.set(event.new_nick, { ...userData, name: event.new_nick });
                        }
                        return next;
                    });
                });

                client.on('userlist', (event) => {
                    console.log(`[IRC] Userlist for ${event.channel}: ${event.users.length}`);
                    const userMap = new Map();
                    event.users.forEach(u => {
                        userMap.set(u.nick, { name: u.nick, isIRC: true, modes: u.modes });
                    });
                    setIrcUsers(userMap);
                });

                client.on('privmsg', (event) => {
                    // For now, we don't strictly need to handle incoming messages here 
                    // because the design might still rely on the backend socket for UNITY?
                    // BUT: The user effectively wants "client side".
                    // If we want to show messages, we need to expose them.
                    // However, the current hook only returns `ircUsers`. 
                    // To keep it simple and fulfill the "G-line" fix first (presence),
                    // we stick to userlist. 
                    // If messages are needed in the UI, we'll need to expand this hook 
                    // to return a `messages` array or an `onMessage` callback.
                });

                client.on('error', (err) => {
                    console.error('[IRC Error]', err);
                    setError(err.message);
                });

                client.on('close', () => {
                    setIsConnected(false);
                    console.log('[IRC] Disconnected');
                });

            } catch (err) {
                console.error('Failed to init IRC:', err);
                setError(err.message);
            }
        };

        connectIRC();

        return () => {
            if (clientRef.current) {
                console.log('[IRC] Cleaning up connection...');
                clientRef.current.quit('Page closed');
                clientRef.current = null;
            }
        };
    }, [user?.name]); // Re-connect only if user name changes significantly

    const sendMessage = useCallback((text) => {
        if (clientRef.current && isConnected) {
            clientRef.current.say('#camrooms', text);
        }
    }, [isConnected]);

    return {
        ircUsers,
        isConnected,
        sendMessage, // Export this so the UI can use it if we wire it up
        error
    };
}
