"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';

export default function GifPicker({ query, onSelect, onClose }) {
    const [gifs, setGifs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);

    // Fetch GIFs when query changes
    useEffect(() => {
        if (!query) {
            setGifs([]);
            return;
        }

        const fetchGifs = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/gif?q=${encodeURIComponent(query)}&limit=20`);
                if (!response.ok) throw new Error('Failed to fetch GIFs');

                const data = await response.json();
                setGifs(data.gifs || []);
            } catch (err) {
                setError(err.message);
                setGifs([]);
            } finally {
                setLoading(false);
            }
        };

        // Debounce the search
        const timeoutId = setTimeout(fetchGifs, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleSelect = (gif) => {
        onSelect(gif.url);
        onClose();
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                background: 'var(--bg-secondary)',
                maxHeight: '300px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span><Icon icon="fontelico:emo-sunglasses" width="18" /></span>
                    <span style={{ fontWeight: '600' }}>GIFs</span>
                    {query && <span style={{ color: 'var(--text-muted)' }}>• "{query}"</span>}
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '18px',
                        padding: '4px',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '8px',
            }}>
                {loading && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '32px',
                        color: 'var(--text-muted)'
                    }}>
                        Searching GIFs...
                    </div>
                )}

                {error && (
                    <div style={{
                        padding: '32px',
                        textAlign: 'center',
                        color: '#FF6B6B'
                    }}>
                        {error}
                    </div>
                )}

                {!loading && !error && gifs.length === 0 && query && (
                    <div style={{
                        padding: '32px',
                        textAlign: 'center',
                        color: 'var(--text-muted)'
                    }}>
                        No GIFs found for "{query}"
                    </div>
                )}

                {!loading && gifs.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '8px',
                    }}>
                        {gifs.map((gif) => (
                            <div
                                key={gif.id}
                                onClick={() => handleSelect(gif)}
                                style={{
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    background: 'rgba(0,0,0,0.3)',
                                    aspectRatio: '1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <img
                                    src={gif.preview || gif.url}
                                    alt={gif.title}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                padding: '8px 16px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                textAlign: 'center',
            }}>
                Powered by Tenor/Giphy
            </div>
        </div>
    );
}
