"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

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

    // Auto-focus search
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

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

    // Grid Cell Renderer for 7TV
    const cellRenderer = ({ columnIndex, rowIndex, style, data }) => {
        const { columns, items } = data;
        const index = rowIndex * columns + columnIndex;
        const item = items[index];

        if (!item) return null;

        return (
            <div style={style} className="emoji-grid-cell">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // For 7TV, we usually want to insert the name ":EmoteName:" or just the name depending on chat handling
                        // ChatPanel handles 'text' vs 'image' logic. 
                        // Usually we insert the text code.
                        onSelect(item.name);
                    }}
                    title={item.name}
                    style={{
                        width: '100%', height: '100%',
                        background: 'transparent', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '4px'
                    }}
                >
                    <img
                        src={item.url}
                        alt={item.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        loading="lazy"
                    />
                </button>
            </div>
        );
    };

    return (
        <div className="emoji-picker glass-panel" style={{
            width: '320px',
            height: '400px',
            background: 'rgba(20, 20, 25, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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
                    <Icon icon="simple-icons:7tv" /> 7TV
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
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
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
                        <AutoSizer>
                            {({ height, width }) => {
                                const COLUMN_COUNT = 5;
                                const COLUMN_WIDTH = width / COLUMN_COUNT;
                                const ROW_HEIGHT = COLUMN_WIDTH; // Square cells
                                const ROW_COUNT = Math.ceil(filtered7TV.length / COLUMN_COUNT);

                                return (
                                    <Grid
                                        columnCount={COLUMN_COUNT}
                                        columnWidth={COLUMN_WIDTH}
                                        height={height}
                                        rowCount={ROW_COUNT}
                                        rowHeight={ROW_HEIGHT}
                                        width={width}
                                        itemData={{ columns: COLUMN_COUNT, items: filtered7TV }}
                                        style={{ overflowX: 'hidden' }}
                                    >
                                        {cellRenderer}
                                    </Grid>
                                );
                            }}
                        </AutoSizer>
                    </div>
                )}
            </div>
        </div>
    );
}

// Add simple hover effect
const style = document.createElement('style');
style.innerHTML = `
  .emoji-btn:hover { background: rgba(255,255,255,0.1) !important; transform: scale(1.2); }
  .emoji-grid-cell button:hover { background: rgba(255,255,255,0.1) !important; transform: scale(1.1); }
`;
if (typeof document !== 'undefined') document.head.appendChild(style);
