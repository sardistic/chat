"use client";

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function RoomBrowser({ onSelectRoom, isDiscordUser }) {
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create Room State
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomDesc, setNewRoomDesc] = useState('');
    const [newRoomBanner, setNewRoomBanner] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

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
                    bannerUrl: newRoomBanner.trim() || null
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
                    background-color: #2a2b30;
                }
                .room-banner-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 100%);
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
                }
                .room-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.3);
                }
                .room-hover-details {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(4px);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                    z-index: 10;
                    padding: 20px;
                    text-align: center;
                }
                .room-card:hover .room-hover-details {
                    opacity: 1;
                }
            `}</style>

            {/* Header */}
            <div className="room-browser-header">
                <div>
                    <h2>Explore Rooms</h2>
                    <p>Discover active communities or start your own</p>
                </div>
                {isDiscordUser && (
                    <button
                        className="btn primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Icon icon="fa:plus" width="14" />
                        Create Room
                    </button>
                )}
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
                            backgroundImage: room.bannerUrl ? `url(${room.bannerUrl})` : 'linear-gradient(135deg, #3b3c45, #1e1e24)'
                        }}>
                            <div className="room-banner-overlay" />
                            <div className="room-icon" style={{
                                position: 'absolute', bottom: '12px', left: '16px',
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: '#1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                {room.iconUrl ? (
                                    <img src={room.iconUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
                                ) : (
                                    <Icon icon="fa:hashtag" width="20" color="#fff" />
                                )}
                            </div>
                            <div style={{ position: 'absolute', bottom: '12px', left: '68px', right: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                    {room.name}
                                </h3>
                            </div>
                        </div>

                        <div className="room-card-content" style={{ padding: '16px' }}>
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

                            <div className="room-card-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div className="status-dot" style={{ background: room.memberCount > 0 ? '#3ba55d' : '#888' }}></div>
                                    <span>{room.memberCount} online</span>
                                </div>
                                <span>{formatTimeAgo(room.lastActive)}</span>
                            </div>
                        </div>

                        {/* Hover Overlay */}
                        <div className="room-hover-details" onClick={(e) => { e.stopPropagation(); onSelectRoom(room); }}>
                            <div style={{ transform: 'translateY(10px)', transition: 'transform 0.2s' }}>
                                <h4 style={{ color: 'white', margin: '0 0 4px', fontSize: '16px' }} title={`Created by ${room.creatorName || 'System'}`}>{room.name}</h4>
                                {room.creatorName && (
                                    <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                                        <Icon icon="fa:user-circle" style={{ marginRight: '4px' }} />
                                        Owner: {room.creatorName || room.creatorId}
                                    </div>
                                )}
                                <div style={{
                                    background: room.activityScore > 50 ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255,255,255,0.1)',
                                    color: room.activityScore > 50 ? '#ff6b6b' : '#fff',
                                    padding: '4px 8px', borderRadius: '12px', fontSize: '11px',
                                    display: 'inline-block', marginBottom: '12px'
                                }}>
                                    {room.activityScore > 50 ? '🔥 High Activity' : '🟢 Online'}
                                </div>
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
