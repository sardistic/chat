"use client";

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function RoomBrowser({ onSelectRoom, isDiscordUser, showCreateModal: externalShowModal, setShowCreateModal: externalSetShowModal }) {
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [internalShowModal, setInternalShowModal] = useState(false);

    // Use external state if provided, otherwise use internal
    const showCreateModal = externalShowModal !== undefined ? externalShowModal : internalShowModal;
    const setShowCreateModal = externalSetShowModal !== undefined ? externalSetShowModal : setInternalShowModal;

    // Create Room State
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomDesc, setNewRoomDesc] = useState('');
    const [newRoomBanner, setNewRoomBanner] = useState('');
    const [newRoomTags, setNewRoomTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

    // Tag suggestions - fun categories for chat rooms
    const SUGGESTED_TAGS = [
        // Topics
        { name: 'gaming', emoji: '🎮', color: '#9333ea' },
        { name: 'music', emoji: '🎵', color: '#ec4899' },
        { name: 'anime', emoji: '🌸', color: '#f472b6' },
        { name: 'movies', emoji: '🎬', color: '#f59e0b' },
        { name: 'tech', emoji: '💻', color: '#3b82f6' },
        { name: 'art', emoji: '🎨', color: '#8b5cf6' },
        { name: 'memes', emoji: '🤣', color: '#22c55e' },
        { name: 'sports', emoji: '⚽', color: '#ef4444' },
        { name: 'coding', emoji: '👨‍💻', color: '#06b6d4' },
        { name: 'vtuber', emoji: '🦋', color: '#a855f7' },
        { name: 'irl', emoji: '📷', color: '#f97316' },
        // Vibes/Mood
        { name: 'chill', emoji: '😌', color: '#14b8a6' },
        { name: 'hype', emoji: '🔥', color: '#ef4444' },
        { name: 'cozy', emoji: '☕', color: '#a16207' },
        { name: 'chaotic', emoji: '🌀', color: '#7c3aed' },
        { name: 'wholesome', emoji: '💖', color: '#db2777' },
        { name: 'late-night', emoji: '🌙', color: '#4f46e5' },
    ];

    // Helper to add custom tag
    const addCustomTag = (tagName) => {
        const sanitized = tagName.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
        if (sanitized.length > 1 && !newRoomTags.includes(sanitized) && newRoomTags.length < 5) {
            setNewRoomTags(prev => [...prev, sanitized]);
            setTagInput('');
        }
    };

    // Fetch rooms on mount
    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/rooms');
            if (!res.ok) throw new Error('Failed to fetch rooms');
            const data = await res.json();
            setRooms(data);
            setError(null);
        } catch (err) {
            console.error('[RoomBrowser] Error:', err);
            setError('Failed to load rooms');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;

        try {
            setIsCreating(true);
            setCreateError(null);

            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newRoomName.trim(),
                    description: newRoomDesc.trim() || null,
                    bannerUrl: newRoomBanner.trim() || null,
                    tags: newRoomTags
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create room');
            }

            // Success - add to list and select it
            setRooms(prev => [data, ...prev]);
            setShowCreateModal(false);
            setNewRoomName('');
            setNewRoomDesc('');
            setNewRoomBanner('');
            setNewRoomTags([]);
            setTagInput('');
            onSelectRoom(data);
        } catch (err) {
            console.error('[RoomBrowser] Create error:', err);
            setCreateError(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    const formatTimeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const getActivityClass = (score) => {
        if (!score) return '';
        if (score >= 80) return 'activity-high';
        if (score >= 40) return 'activity-medium';
        return 'activity-low';
    };

    const isVideo = (url) => {
        if (!url) return false;
        return url.match(/\.(mp4|webm|gifv|mov|mkv)$/i) || url.includes('imgur.com') && url.endsWith('.gifv');
    };

    // Cute Animated Pixel Art Generator
    const generatePixelPattern = (seedString, activityScore) => {
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
            hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Cute/Pastel Palette (Pink, Purple, Teal, Soft Blue)
        const colors = [
            '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA',
            '#F48FB1', '#CE93D8', '#90CAF9', '#80CBC4', '#A5D6A7', '#FFF59D'
        ];

        // Grid Size
        const gridSize = 12;
        const pixelSize = 40;
        const width = gridSize * pixelSize;
        const height = width / 2; // Aspect ratio

        // Background color (Dark but slightly tinted)
        const bg = '#1a1b20';

        let rects = '';

        // Procedural generation
        for (let y = 0; y < gridSize / 2; y++) {
            for (let x = 0; x < gridSize; x++) {
                const pixelHash = (hash + x * 31 + y * 17);
                // Lower threshold = fewer pixels. Activity increases density.
                const isActive = (pixelHash % 100) < (20 + (activityScore / 2.5));

                if (isActive) {
                    const colorIdx = Math.abs(pixelHash) % colors.length;
                    const color = colors[colorIdx];

                    // Random animation parameters
                    const duration = 2 + (Math.abs(pixelHash % 40) / 10); // 2-6s duration
                    const delay = Math.abs(pixelHash % 20) / 10; // 0-2s delay
                    const keyTimes = (pixelHash % 2 === 0) ? "0;0.5;1" : "0;1";
                    const values = (pixelHash % 2 === 0) ? "0.4;0.8;0.4" : "0.3;0.7"; // Opacity throb

                    rects += `
                    <rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${color}" opacity="0.5">
                        <animate attributeName="opacity" values="${values}" dur="${duration}s" begin="${delay}s" repeatCount="indefinite" />
                    </rect>`;
                }
            }
        }

        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">
            <rect width="100%" height="100%" fill="${bg}"/>
            ${rects}
        </svg>`;

        return `url('data:image/svg+xml;base64,${btoa(svg)}')`;
    };

    if (isLoading) {
        return (
            <div className="room-browser-loading">
                <Icon icon="svg-spinners:3-dots-scale" width="48" />
                <p>Loading rooms...</p>
            </div>
        );
    }

    return (
        <div className="room-browser">
            <style jsx>{`
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.4); border-color: rgba(167, 139, 250, 0.6); }
                    70% { box-shadow: 0 0 0 10px rgba(167, 139, 250, 0); border-color: rgba(167, 139, 250, 0.3); }
                    100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0); border-color: rgba(167, 139, 250, 0.6); }
                }
                @keyframes tag-pop {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes tag-wiggle {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-3deg); }
                    75% { transform: rotate(3deg); }
                }
                .activity-high {
                    animation: pulse-glow 2s infinite;
                    border: 1px solid var(--accent-primary) !important;
                }
                .activity-medium {
                    border: 1px solid rgba(167, 139, 250, 0.5) !important;
                }
                .room-card-banner {
                    height: 100px;
                    background-size: cover;
                    background-position: center;
                    position: relative;
                    border-radius: 12px 12px 0 0;
                    background-color: rgba(42, 43, 48, 0.3);
                    overflow: hidden;
                }
                .room-banner-media {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    position: absolute;
                    inset: 0;
                }
                .room-banner-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 100%);
                    z-index: 1;
                }
                .ai-summary {
                    font-size: 12px;
                    color: var(--text-secondary);
                    background: rgba(167, 139, 250, 0.1);
                    border: 1px solid rgba(167, 139, 250, 0.2);
                    padding: 8px;
                    border-radius: 8px;
                    margin-top: 8px;
                    display: flex;
                    gap: 6px;
                    align-items: flex-start;
                }
                .room-card {
                    overflow: hidden;
                    transition: transform 0.2s, box-shadow 0.2s;
                    background: rgba(20, 20, 25, 0.6);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                }
                .room-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.3);
                }
                .now-playing {
                    font-size: 11px;
                    color: #fff;
                    background: rgba(255, 80, 80, 0.15);
                    border: 1px solid rgba(255, 80, 80, 0.3);
                    padding: 6px 8px;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .room-card:hover .room-hover-details {
                    opacity: 1;
                }
                .room-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-top: 8px;
                }
                .room-tag {
                    font-size: 10px;
                    padding: 2px 8px;
                    border-radius: 12px;
                    background: rgba(147, 51, 234, 0.15);
                    color: #a78bfa;
                    border: 1px solid rgba(147, 51, 234, 0.3);
                }
                .tag-picker {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 8px;
                }
                .tag-suggestion {
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                    border: 2px solid transparent;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .tag-suggestion:hover {
                    transform: scale(1.05);
                    animation: tag-wiggle 0.3s ease-in-out;
                }
                .tag-suggestion.selected {
                    animation: tag-pop 0.3s ease-out forwards;
                    border-color: currentColor;
                    box-shadow: 0 0 12px currentColor;
                }
                .selected-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 12px;
                }
                .selected-tag {
                    padding: 4px 10px;
                    border-radius: 16px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    animation: tag-pop 0.2s ease-out;
                }
                .selected-tag button {
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 0;
                    font-size: 14px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                .selected-tag button:hover {
                    opacity: 1;
                }
            `}</style>

            {/* Header */}
            <div className="room-browser-header">
                <div>
                    <h2>Explore Rooms</h2>
                    <p>Discover active communities or start your own</p>
                </div>
            </div>

            {error && (
                <div className="room-browser-error">
                    <Icon icon="fa:exclamation-triangle" width="16" />
                    {error}
                    <button onClick={fetchRooms} className="btn">Retry</button>
                </div>
            )}

            {/* Room Grid */}
            <div className="room-grid">
                {rooms.map(room => (
                    <div
                        key={room.id}
                        className={`room-card ${getActivityClass(room.activityScore)}`}
                        onClick={() => onSelectRoom(room)}
                        style={{ position: 'relative' }}
                    >
                        <div className="room-card-banner" style={{
                            background: !room.bannerUrl ? '#000' : 'none'
                        }}>
                            {isVideo(room.bannerUrl) ? (
                                <video
                                    src={room.bannerUrl}
                                    className="room-banner-media"
                                    autoPlay loop muted playsInline
                                />
                            ) : (
                                // GENERATED PIXEL ART
                                <div
                                    className="room-banner-media"
                                    style={{
                                        backgroundImage: room.bannerUrl ? `url(${room.bannerUrl})` : generatePixelPattern(room.name, room.activityScore || 0),
                                        backgroundSize: room.bannerUrl ? 'cover' : 'cover',
                                        imageRendering: room.bannerUrl ? 'auto' : 'pixelated'
                                    }}
                                />
                            )}

                            <div className="room-banner-overlay" />
                            <div className="room-icon" style={{
                                position: 'absolute', bottom: '12px', left: '16px',
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: '#1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                                overflow: 'hidden', zIndex: 2
                            }}>
                                {room.iconUrl ? (
                                    isVideo(room.iconUrl) ? (
                                        <video src={room.iconUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <img src={room.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )
                                ) : (
                                    <Icon icon="fa:hashtag" width="20" color="#fff" />
                                )}
                            </div>
                            <div style={{ position: 'absolute', bottom: '12px', left: '68px', right: '12px', zIndex: 2 }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                    {room.name}
                                </h3>
                            </div>
                        </div>

                        <div className="room-card-content" style={{ padding: '12px' }}>
                            {room.currentVideoTitle && (
                                <div className="now-playing" title={room.currentVideoTitle}>
                                    <Icon icon="fa:youtube-play" width="12" style={{ color: '#ff5050', flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.currentVideoTitle}</span>
                                </div>
                            )}
                            {room.shortSummary ? (
                                <div className="ai-summary">
                                    <Icon icon="fa:magic" width="12" style={{ marginTop: '2px', color: 'var(--accent-primary)' }} />
                                    <span>{room.shortSummary}</span>
                                </div>
                            ) : (
                                <p className="room-description" style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                                    {room.description || "No description provided."}
                                </p>
                            )}

                            {/* Tags */}
                            {room.tags && room.tags.length > 0 && (
                                <div className="room-tags">
                                    {room.tags.slice(0, 3).map(tag => {
                                        const tagInfo = SUGGESTED_TAGS.find(t => t.name === tag);
                                        return (
                                            <span key={tag} className="room-tag" style={tagInfo ? { background: `${tagInfo.color}20`, color: tagInfo.color, borderColor: `${tagInfo.color}50` } : {}}>
                                                {tagInfo?.emoji} {tag}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="room-card-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Icon icon="fa:users" width="12" />
                                    <span>{room.memberCount}</span>
                                </div>
                                <span>{formatTimeAgo(room.lastActive)}</span>
                            </div>
                        </div>

                        {/* Hover Overlay */}
                        <div className="room-hover-details" onClick={(e) => { e.stopPropagation(); onSelectRoom(room); }}>
                            <div style={{ transform: 'translateY(10px)', transition: 'transform 0.2s' }}>
                                <h4 style={{ color: 'white', margin: '0 0 4px', fontSize: '16px' }}>{room.name}</h4>
                                {room.creatorName && (
                                    <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                                        <Icon icon="fa:user-circle" style={{ marginRight: '4px' }} />
                                        Owner: {room.creatorName}
                                    </div>
                                )}
                                {room.shortSummary && (
                                    <div style={{ fontSize: '11px', color: '#eee', margin: '4px 0 8px', maxWidth: '85%', lineHeight: '1.4' }}>
                                        {room.shortSummary}
                                    </div>
                                )}
                                {room.sentiment && room.sentiment !== 'Quiet' && (
                                    <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '8px', fontStyle: 'italic', background: 'rgba(167, 139, 250, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                        <Icon icon="fa:magic" style={{ marginRight: '4px' }} />
                                        Mood: {room.sentiment}
                                    </div>
                                )}
                                {room.activityScore > 50 && (
                                    <div style={{
                                        background: 'rgba(255, 107, 107, 0.2)',
                                        color: '#ff6b6b',
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '11px',
                                        display: 'inline-block', marginBottom: '12px'
                                    }}>
                                        🔥 High Activity
                                    </div>
                                )}
                                <div className="btn primary small" style={{ width: 'auto', margin: '0 auto' }}>
                                    Join Room
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {rooms.length === 0 && !error && (
                    <div className="room-browser-empty">
                        <Icon icon="fa:comments-o" width="48" />
                        <p>No rooms found.</p>
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="create-room-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create a New Room</h3>
                            <button className="btn icon-btn" onClick={() => setShowCreateModal(false)}>
                                <Icon icon="fa:times" width="18" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRoom}>
                            <div className="form-group">
                                <label>Room Name *</label>
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={e => setNewRoomName(e.target.value)}
                                    placeholder="e.g., Chill Vibes"
                                    maxLength={32}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Banner URL (optional)</label>
                                <input
                                    type="text"
                                    value={newRoomBanner}
                                    onChange={e => setNewRoomBanner(e.target.value)}
                                    placeholder="https://..."
                                />
                                <p className="form-hint">Image for the room card background</p>
                            </div>

                            <div className="form-group">
                                <label>Description / Topic</label>
                                <textarea
                                    value={newRoomDesc}
                                    onChange={e => setNewRoomDesc(e.target.value)}
                                    placeholder="What's happening here?"
                                    maxLength={200}
                                    rows={3}
                                />
                            </div>

                            {/* Fun Tag Picker */}
                            <div className="form-group">
                                <label>Tags ✨ <span style={{ fontWeight: 'normal', fontSize: '11px', color: 'var(--text-muted)' }}>(pick up to 5)</span></label>
                                <div className="tag-picker">
                                    {SUGGESTED_TAGS.map(tag => {
                                        const isSelected = newRoomTags.includes(tag.name);
                                        return (
                                            <div
                                                key={tag.name}
                                                className={`tag-suggestion ${isSelected ? 'selected' : ''}`}
                                                style={{
                                                    background: isSelected ? `${tag.color}30` : `${tag.color}15`,
                                                    color: tag.color
                                                }}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setNewRoomTags(prev => prev.filter(t => t !== tag.name));
                                                    } else if (newRoomTags.length < 5) {
                                                        setNewRoomTags(prev => [...prev, tag.name]);
                                                    }
                                                }}
                                            >
                                                <span style={{ fontSize: '16px' }}>{tag.emoji}</span>
                                                {tag.name}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Custom tag input */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomTag(tagInput);
                                            }
                                        }}
                                        placeholder="+ Custom tag..."
                                        maxLength={20}
                                        disabled={newRoomTags.length >= 5}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: '20px',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            fontSize: '13px'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => addCustomTag(tagInput)}
                                        disabled={!tagInput.trim() || newRoomTags.length >= 5}
                                        style={{ borderRadius: '20px', padding: '8px 16px' }}
                                    >
                                        Add
                                    </button>
                                </div>

                                {newRoomTags.length > 0 && (
                                    <div className="selected-tags">
                                        {newRoomTags.map(tagName => {
                                            const tag = SUGGESTED_TAGS.find(t => t.name === tagName);
                                            return (
                                                <div
                                                    key={tagName}
                                                    className="selected-tag"
                                                    style={{ background: `${tag?.color || '#a78bfa'}30`, color: tag?.color || '#a78bfa' }}
                                                >
                                                    {tag?.emoji || '🏷️'} {tagName}
                                                    <button type="button" onClick={() => setNewRoomTags(prev => prev.filter(t => t !== tagName))}>×</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {createError && (
                                <div className="form-error">
                                    <Icon icon="fa:exclamation-circle" width="14" />
                                    {createError}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn primary" disabled={isCreating || !newRoomName.trim()}>
                                    {isCreating ? 'Creating...' : 'Create Room'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {!isDiscordUser && (
                <div className="room-browser-login-prompt">
                    <div className="login-prompt-content">
                        <Icon icon="fa:plus-circle" width="24" />
                        <div>
                            <p><strong>Want to create a room?</strong></p>
                            <p>Login with Discord to create and manage your own rooms</p>
                        </div>
                    </div>
                    <button
                        className="btn discord-login-btn"
                        onClick={() => {
                            import('next-auth/react').then(({ signIn }) => {
                                signIn('discord', { callbackUrl: '/' });
                            });
                        }}
                    >
                        <div style={{ marginRight: '8px', display: 'flex' }}>
                            <svg width="20" height="20" viewBox="0 0 71 55" fill="currentColor">
                                <path d="M60.1 4.9A58.5 58.5 0 0045.4.5a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.6a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.4.2.2 0 00-.1.1C1.5 18.2-.9 31 .3 43.7a.2.2 0 00.1.1 58.8 58.8 0 0017.7 8.9.2.2 0 00.2 0 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2 0 58.6 58.6 0 0017.7-8.9.2.2 0 00.1-.1c1.4-14.5-2.4-27.1-10-38.3a.2.2 0 00-.1-.1zM23.7 35.8c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.6-6.7 6-6.7c3.3 0 6 3 6 6.7 0 3.7-2.7 6.7-6 6.7z" />
                            </svg>
                        </div>
                        Login with Discord
                    </button>
                </div>
            )}
        </div>
    );
}
