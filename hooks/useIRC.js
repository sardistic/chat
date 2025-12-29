"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socket";

// Dynamic import or require for browser-compatible IRC framework might be tricky in SSR.
// We'll use a dynamic import inside useEffect or assume the bundler handles 'irc-framework/browser'.
// Since we can't easily rely on 'irc-framework/browser' resolving flawlessly in all Next.js setups without config,
// we will try standard import and see if it falls back or use the kiwi-irc specific client approach if needed.
// However, 'irc-framework' claims browser support.
// A common public gateway for GameSurge via Kiwi is often just a direct websocket or via kiwi's gateway.
// User suggested 'kiwiirc/webircgateway'.
// We will try connecting to a known public gateway.

export function useIRC(user) {
    const { socket } = useSocket();
    const [ircUsers, setIrcUsers] = useState(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef(null);

    useEffect(() => {
        if (!user || !user.name) return;

        let client;

        // Dynamic import to avoid SSR issues with irc-framework browser build
        import('irc-framework/dist/browser/src/index.js').then((IRC) => {
            client = new IRC.Client();
            clientRef.current = client;

            const nick = user.name.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize
            const channel = '#camsrooms';

            console.log(`[IRC] Connecting to GameSurge as ${nick}...`);

            // Using KiwiIRC's public gateway for GameSurge usually follows this pattern
            // or we can try direct WS if GameSurge supports it.
            // GameSurge doesn't natively advertise WS. KiwiIRC uses a gateway.
            // URL: wss://kiwiirc.com/webirc/gamesurge/ usually proxies to irc.gamesurge.net
            client.connect({
                host: 'irc.gamesurge.net', // The hostname the gateway connects TO
                port: 6667,
                nick: nick,
                username: nick,
                gecos: 'CamRooms User',
                transport: {
                    // This creates a websocket connection to the gateway
                    // The gateway then connects to host:port
                    type: 'websocket',
                    url: 'wss://kiwiirc.com/webirc/gamesurge/bind'
                    // Note: 'bind' is often the endpoint for some gateways, or just /
                    // If this fails, we might need a different gateway or run our own.
                    // Given the user said "figure it out like kiwiirc", we try their public infra.
                }
            });

            client.on('registered', () => {
                console.log('[IRC] Registered!');
                setIsConnected(true);
                client.join(channel);
            });

            client.on('join', (event) => {
                const { nick } = event;
                setIrcUsers((prev) => {
                    const next = new Map(prev);
                    next.set(nick, { name: nick, isIRC: true });
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

            client.on('wholist', (event) => {
                // event.users
                if (event.users) {
                    setIrcUsers(prev => {
                        const next = new Map(prev);
                        event.users.forEach(u => next.set(u.nick, { name: u.nick, isIRC: true }));
                        return next;
                    });
                }
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

            client.on('message', (event) => {
                // Forward IRC messages to the ChatPanel via a custom event or store them?
                // Ideally, we want them to appear in the chat.
                // Since ChatPanel uses `socket` for messages, we can:
                // 1. Locally inject them into state (harder to sync)
                // 2. We are REPLACING the socket bridge.
                // The ChatPanel needs to know about these.
                // We'll expose `messages` from this hook or an `onMessage` callback.

                // For now, let's just log. The `socket` chat system is currently separate.
                // The user wants IRC users to "come from the user".
                // We'll handle outgoing via client.say
            });

            client.on('close', () => {
                console.log('[IRC] Disconnected');
                setIsConnected(false);
                setIrcUsers(new Map());
            });

            // Allow sending from outside
            // We need to export a send function
        });

        return () => {
            if (client) {
                client.quit();
            }
        };
    }, [user]);

    const sendMessage = (text) => {
        if (clientRef.current && isConnected) {
            clientRef.current.say('#camsrooms', text);
        }
    };

    return {
        ircUsers,
        isConnected,
        sendMessage
    };
}
