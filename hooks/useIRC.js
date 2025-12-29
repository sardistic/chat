"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// The irc-framework browser build needs to be loaded as a global script
// because the ESM import path doesn't correctly resolve WebSocket transport.

export function useIRC(user) {
    const [ircUsers, setIrcUsers] = useState(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef(null);
    const hasInitialized = useRef(false);

    const sendMessage = useCallback((text) => {
        if (clientRef.current && isConnected) {
            clientRef.current.say('#camsrooms', text);
        }
    }, [isConnected]);

    useEffect(() => {
        if (!user || !user.name || typeof window === 'undefined' || hasInitialized.current) return;
        hasInitialized.current = true;

        const initClient = (IRC) => {
            const client = new IRC.Client();
            clientRef.current = client;

            const nick = user.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 15);
            const channel = '#camsrooms';

            console.log(`[IRC] Connecting to GameSurge as ${nick}...`);

            client.connect({
                host: 'irc.gamesurge.net',
                port: 6667,
                nick: nick,
                username: nick,
                gecos: 'CamRooms User',
                transport: IRC.transports.websocket,
                transportOptions: {
                    url: 'wss://kiwiirc.com/webirc/gamesurge/'
                }
            });

            client.on('registered', () => {
                console.log('[IRC] Registered!');
                setIsConnected(true);
                client.join(channel);
            });

            client.on('join', (event) => {
                setIrcUsers((prev) => {
                    const next = new Map(prev);
                    next.set(event.nick, { name: event.nick, isIRC: true });
                    return next;
                });
            });

            client.on('part', (event) => {
                setIrcUsers((prev) => {
                    const next = new Map(prev);
                    next.delete(event.nick);
                    return next;
                });
            });

            client.on('quit', (event) => {
                setIrcUsers((prev) => {
                    const next = new Map(prev);
                    next.delete(event.nick);
                    return next;
                });
            });

            client.on('userlist', (event) => {
                if (event.users) {
                    setIrcUsers(prev => {
                        const next = new Map(prev);
                        event.users.forEach(u => next.set(u.nick, { name: u.nick, isIRC: true, modes: u.modes }));
                        return next;
                    });
                }
            });

            client.on('close', () => {
                console.log('[IRC] Disconnected');
                setIsConnected(false);
                setIrcUsers(new Map());
            });
        };

        // Load irc-framework browser bundle via script tag
        if (window.irc) {
            initClient(window.irc);
        } else {
            const script = document.createElement('script');
            script.src = '/irc-browser.js';
            script.onload = () => {
                if (window.irc) {
                    initClient(window.irc);
                }
            };
            script.onerror = (e) => {
                console.error('[IRC] Failed to load browser bundle:', e);
            };
            document.head.appendChild(script);
        }

        return () => {
            if (clientRef.current) {
                clientRef.current.quit();
            }
        };
    }, [user]);

    return {
        ircUsers,
        isConnected,
        sendMessage
    };
}
