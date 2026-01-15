"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Grid } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

// Standard Emoji Categories (Subset for simplicity)
const STANDARD_EMOJIS = [
    { category: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😭', '😉', '😊', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'] },
    { category: 'Gestures', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'] },
    { category: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'] },
    { category: 'Objects/Symbols', emojis: ['🔥', '✨', '🌟', '💫', '💥', '💢', '💦', '💧', '💤', '🎉', '🎊', '🎈', '🎁', '🎂', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🔔', '🔕', '📣', '📢', '🎵', '🎶', '💯', '⚠️', '⛔', '🚫', '✅', '✔️'] }
];

export default function EmojiPicker({ onSelect, emotes = new Map(), onClose, style = {} }) {
    const [tab, setTab] = useState('emoji'); // 'emoji' | '7tv'
    const [search, setSearch] = useState('');
    const inputRef = useRef(null);
    const pickerRef = useRef(null);

    // Debug: Log emotes received
    console.log('[EmojiPicker] Emotes received:', emotes?.size || 0, 'emotes');

    // Auto-focus search
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                onClose?.();
            }
        };

        // Add listener with a slight delay to prevent immediate close on open
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Filter Standard Emojis
    const filteredEmojis = useMemo(() => {
        if (tab !== 'emoji') return [];
        if (!search) return STANDARD_EMOJIS;

        const lowerSearch = search.toLowerCase();
        return STANDARD_EMOJIS.map(cat => ({
            category: cat.category,
            emojis: cat.emojis.filter(e => e.includes(search)) // Only simple matching for now
            // Note: Proper emoji search requires a huge library of keywords (emoji-mart etc.), keeping it simple for now.
        })).filter(cat => cat.emojis.length > 0);
    }, [tab, search]);

    // Filter 7TV Emotes
    const filtered7TV = useMemo(() => {
        if (tab !== '7tv') return [];
        const allEmotes = Array.from(emotes.entries()).map(([name, url]) => ({ name, url }));
        if (!search) return allEmotes;
        return allEmotes.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    }, [tab, search, emotes]);

    return (
        <div ref={pickerRef} className="emoji-picker glass-panel" style={{
            width: '320px',
            height: '400px',
            background: 'var(--glass-bg-heavy)',
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--glass-shadow)',
            ...style
        }} onClick={(e) => e.stopPropagation()}>
            {/* Header Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                    onClick={() => setTab('emoji')}
                    style={{
                        flex: 1, padding: '10px', background: tab === 'emoji' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: tab === 'emoji' ? 'white' : '#888', border: 'none', cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    Emojis
                </button>
                <button
                    onClick={() => setTab('7tv')}
                    style={{
                        flex: 1, padding: '10px', background: tab === '7tv' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: tab === '7tv' ? 'white' : '#888', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                >
                    <Icon icon="simple-icons:7tv" /> 7TV ({emotes?.size || 0})
                </button>
            </div>

            {/* Search */}
            <div style={{ padding: '8px' }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={tab === 'emoji' ? "Search Emoji..." : "Search 7TV..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '8px 12px', borderRadius: '6px',
                        background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
                        color: 'white', fontSize: '13px'
                    }}
                />
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {tab === 'emoji' ? (
                    <div style={{ height: '100%', overflowY: 'auto', padding: '0 8px' }}>
                        {filteredEmojis.map((cat, i) => (
                            <div key={i} style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                    {cat.category}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
                                    {cat.emojis.map(bg => (
                                        <button
                                            key={bg}
                                            onClick={(e) => { e.stopPropagation(); onSelect(bg); }}
                                            style={{
                                                fontSize: '20px', cursor: 'pointer', background: 'transparent',
                                                border: 'none', padding: '4px', borderRadius: '4px'
                                            }}
                                            className="emoji-btn"
                                        >
                                            {bg}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ height: '100%', width: '100%' }}>
                        {filtered7TV.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                {emotes?.size > 0 ? 'No matches found' : 'Loading or no emotes...'}
                            </div>
                        ) : (
                            <div style={{ height: '100%', overflowY: 'auto', padding: '8px' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                    gap: '8px'
                                }}>
                                    {filtered7TV.map((item) => (
                                        <button
                                            key={item.name}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelect(item.name);
                                            }}
                                            title={item.name}
                                            style={{
                                                aspectRatio: '1',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '4px',
                                                borderRadius: '6px'
                                            }}
                                            className="emoji-grid-cell"
                                        >
                                            <img
                                                src={item.url}
                                                alt={item.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain'
                                                }}
                                                loading="lazy"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Add simple hover effect
// Add simple hover effect
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
      .emoji-btn:hover { background: rgba(255,255,255,0.1) !important; transform: scale(1.2); }
      .emoji-grid-cell button:hover { background: rgba(255,255,255,0.1) !important; transform: scale(1.1); }
    `;
    document.head.appendChild(style);
}
