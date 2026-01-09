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
                                <Icon icon="fa:comments" width="24" />
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
                <div className="room-browser-guest-notice">
                    <Icon icon="fa:info-circle" width="16" />
                    Login with Discord to create your own rooms
                </div>
            )}
        </div>
    );
}
