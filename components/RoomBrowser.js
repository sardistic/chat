"use client";

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function RoomBrowser({ onSelectRoom, isDiscordUser }) {
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomDesc, setNewRoomDesc] = useState('');
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
                    description: newRoomDesc.trim() || null
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
            {/* Header */}
            <div className="room-browser-header">
                <div>
                    <h2>Choose a Room</h2>
                    <p>Join an existing room or create your own</p>
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
                        className="room-card"
                        onClick={() => onSelectRoom(room)}
                    >
                        <div className="room-card-header">
                            <div className="room-icon">
                                {room.iconUrl ? (
                                    <img src={room.iconUrl} alt={room.name} />
                                ) : (
                                    <Icon icon="fa:comments" width="24" />
                                )}
                            </div>
                            <div className="room-info">
                                <h3>{room.name}</h3>
                                <span className="room-slug">#{room.slug}</span>
                            </div>
                        </div>

                        {room.description && (
                            <p className="room-description">{room.description}</p>
                        )}

                        <div className="room-card-footer">
                            <div className="room-stat">
                                <Icon icon="fa:users" width="14" />
                                <span>{room.memberCount} online</span>
                            </div>
                            <div className="room-stat">
                                <Icon icon="fa:clock-o" width="14" />
                                <span>{formatTimeAgo(room.lastActive)}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {rooms.length === 0 && !error && (
                    <div className="room-browser-empty">
                        <Icon icon="fa:comments-o" width="48" />
                        <p>No rooms yet. Be the first to create one!</p>
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
                                    placeholder="e.g., Gaming, Music, Chill"
                                    maxLength={32}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Description (optional)</label>
                                <textarea
                                    value={newRoomDesc}
                                    onChange={e => setNewRoomDesc(e.target.value)}
                                    placeholder="What's this room about?"
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
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn primary"
                                    disabled={isCreating || !newRoomName.trim()}
                                >
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
                        <svg width="20" height="20" viewBox="0 0 71 55" fill="currentColor">
                            <path d="M60.1 4.9A58.5 58.5 0 0045.4.5a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.6a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.4.2.2 0 00-.1.1C1.5 18.2-.9 31 .3 43.7a.2.2 0 00.1.1 58.8 58.8 0 0017.7 8.9.2.2 0 00.2 0 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2 0 58.6 58.6 0 0017.7-8.9.2.2 0 00.1-.1c1.4-14.5-2.4-27.1-10-38.3a.2.2 0 00-.1-.1zM23.7 35.8c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.6-6.7 6-6.7c3.3 0 6 3 6 6.7 0 3.7-2.7 6.7-6 6.7z" />
                        </svg>
                        Login with Discord
                    </button>
                </div>
            )}
        </div>
    );
}
