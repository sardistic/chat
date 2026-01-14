"use client";

import { useState, useEffect } from 'react';

// Default to a popular global set
const DEFAULT_EMOTE_SET = "global";

export function useEmotes(emoteSetId = DEFAULT_EMOTE_SET) {
    const [emotes, setEmotes] = useState(new Map());
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;

        const fetchEmotes = async () => {
            try {
                // Fetch Global Emotes from 7TV using the correct endpoint
                const globalRes = await fetch(`https://7tv.io/v3/emote-sets/global`);
                const globalData = await globalRes.json();

                // Fetch Specific Set (if different)
                let customData = { emotes: [] };
                if (emoteSetId && emoteSetId !== 'global') {
                    const res = await fetch(`https://7tv.io/v3/emote-sets/${emoteSetId}`);
                    customData = await res.json();
                }

                if (!mounted) return;

                const emoteMap = new Map();

                // Process Global - API returns array directly
                const globalEmotes = Array.isArray(globalData) ? globalData : (globalData.emotes || []);
                globalEmotes.forEach(emote => {
                    const url = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`;
                    emoteMap.set(emote.name, url);
                });

                // Process Custom (overrides global if same name)
                if (customData.emotes) {
                    customData.emotes.forEach(emote => {
                        const url = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`;
                        emoteMap.set(emote.name, url);
                    });
                }

                console.log(`[7TV] Loaded ${emoteMap.size} emotes.`);
                setEmotes(emoteMap);
                setIsLoaded(true);
            } catch (err) {
                console.error("[7TV] Failed to load emotes:", err);
            }
        };

        fetchEmotes();

        return () => { mounted = false; };
    }, [emoteSetId]);

    return { emotes, isLoaded };
}
