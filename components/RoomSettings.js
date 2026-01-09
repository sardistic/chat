"use client";

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function RoomSettings({ roomId, isOpen, onClose }) {
    const [isLoading, setIsLoading] = useState(true);
    const [roomData, setRoomData] = useState(null);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [iconUrl, setIconUrl] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [newModId, setNewModId] = useState('');

    const isVideo = (url) => {
        if (!url) return false;
        return url.match(/\.(mp4|webm|gifv|mov|mkv)$/i) || (url.includes('imgur.com') && url.endsWith('.gifv'));
    };

    useEffect(() => {
        if (isOpen && roomId) {
            fetchRoomDetails();
        }
    }, [isOpen, roomId]);




    const handleAddMod = async () => {
        if (!newModId.trim()) return;
        try {
            setIsSaving(true);
            setError(null);
            const res = await fetch(`/api/rooms/${roomId}/moderators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: newModId.trim() })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setNewModId('');
            fetchRoomDetails(); // Refresh list
            setSaveMessage('Moderator added successfully');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveMod = async (userId) => {
        if (!confirm('Remove this moderator?')) return;
        try {
            setIsSaving(true);
            setError(null);
            const res = await fetch(`/api/rooms/${roomId}/moderators?userId=${userId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            fetchRoomDetails(); // Refresh list
            setSaveMessage('Moderator removed successfully');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const fetchRoomDetails = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const res = await fetch(`/api/rooms/${roomId}/settings`);

            if (!res.ok) {
                if (res.status === 401) throw new Error('You must be logged in to view settings');
                if (res.status === 403) throw new Error('Not authorized to view settings');
                if (res.status === 404) throw new Error('Room not found');
                throw new Error('Failed to load room settings');
            }

            const data = await res.json();
            setRoomData(data);

            // Init form
            setName(data.name || '');
            setDescription(data.description || '');
            setIconUrl(data.iconUrl || '');
            setBannerUrl(data.bannerUrl || '');
        } catch (err) {
            console.error('[RoomSettings] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!roomData?.canEdit) return;

        try {
            setIsSaving(true);
            setSaveMessage(null);
            setError(null);

            const res = await fetch(`/api/rooms/${roomId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    iconUrl: iconUrl.trim() || null,
                    bannerUrl: bannerUrl.trim() || null
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to update room');
            }

            setRoomData(prev => ({ ...prev, ...data }));
            setSaveMessage('Room settings updated successfully!');

        } catch (err) {
            console.error('[RoomSettings] Save error:', err);
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (!roomData?.isOwner) return;

        const confirmName = prompt(`DANGER: This will permanently delete the room.\nTo confirm, please type the room name: "${roomData.name}"`);
        if (confirmName !== roomData.name) {
            if (confirmName !== null) alert("Room name did not match. Deletion cancelled.");
            return;
        }

        try {
            setIsSaving(true); // Lock UI
            setError(null);

            // Use the slug or roomId - Route uses slug in params usually, but here roomId prop passed might be slug or ID?
            // ClientApp passes `roomId` which is usually the SLUG (e.g. 'general' or 'room-123').
            // Let's ensure we use the slug from roomData if available, or roomId prop.
            const targetSlug = roomData.slug || roomId;

            const res = await fetch(`/api/rooms/${targetSlug}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete room');
            }

            // Success - Redirect to home
            window.location.href = '/';
        } catch (err) {
            console.error('[RoomSettings] Delete error:', err);
            setError(err.message);
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content room-settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Room Settings</h2>
                    <button className="btn icon-btn" onClick={onClose}>
                        <Icon icon="fa:times" width="18" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <Icon icon="svg-spinners:3-dots-scale" width="32" />
                        <p>Loading settings...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <Icon icon="fa:exclamation-triangle" width="32" color="#ef4444" />
                        <p>{error}</p>
                        <button className="btn" onClick={onClose}>Close</button>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="settings-form">
                        {!roomData.canEdit && (
                            <div className="notice-banner">
                                <Icon icon="fa:lock" width="14" />
                                You are viewing these settings in read-only mode
                            </div>
                        )}

                        <div className="form-group">
                            <label>Room Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                disabled={!roomData.canEdit}
                                maxLength={32}
                                required
                            />
                            <small className="hint">The unique URL slug (#{roomData.slug}) cannot be changed.</small>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                disabled={!roomData.canEdit}
                                maxLength={200}
                                rows={3}
                            />
                        </div>

                        <div className="form-group">
                            <label>Icon URL</label>
                            <div className="input-with-preview">
                                <input
                                    type="url"
                                    value={iconUrl}
                                    onChange={e => setIconUrl(e.target.value)}
                                    disabled={!roomData.canEdit}
                                    placeholder="https://example.com/icon.png"
                                />
                                {iconUrl && (
                                    <div className="icon-preview">
                                        {isVideo(iconUrl) ? (
                                            <video
                                                src={iconUrl}
                                                autoPlay loop muted playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                            />
                                        ) : (
                                            <img
                                                src={iconUrl}
                                                alt="Preview"
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Banner URL</label>
                            <div className="input-with-preview">
                                <input
                                    type="url"
                                    value={bannerUrl}
                                    onChange={e => setBannerUrl(e.target.value)}
                                    disabled={!roomData.canEdit}
                                    placeholder="https://example.com/banner.jpg"
                                />
                                {bannerUrl && (
                                    <div className="banner-preview" style={{ marginTop: '8px', height: '60px', borderRadius: '8px', background: '#333', overflow: 'hidden' }}>
                                        {isVideo(bannerUrl) ? (
                                            <video
                                                src={bannerUrl}
                                                autoPlay loop muted playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <img
                                                src={bannerUrl}
                                                alt="Banner Preview"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                            <small className="hint">Displayed on the room card in the browser.</small>
                        </div>

                        <div className="moderators-section">
                            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3>Moderators</h3>
                            </div>

                            {roomData.isOwner && (
                                <div className="add-mod-form" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                    <input
                                        type="text"
                                        placeholder="Enter Discord User ID"
                                        value={newModId}
                                        onChange={(e) => setNewModId(e.target.value)}
                                        style={{ flex: 1, fontSize: '13px', padding: '8px' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn primary"
                                        onClick={handleAddMod}
                                        disabled={!newModId.trim() || isSaving}
                                        style={{ padding: '8px 12px', fontSize: '12px' }}
                                    >
                                        Add
                                    </button>
                                </div>
                            )}

                            <div className="moderators-list">
                                <div className="mod-item owner">
                                    <Icon icon="fa:crown" width="14" />
                                    <span>Owner (Creator)</span>
                                </div>
                                {roomData.moderators?.map(mod => (
                                    <div key={mod.userId} className="mod-item">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                            <Icon icon="fa:shield" width="14" />
                                            <span style={{ fontFamily: 'monospace' }}>{mod.userId}</span>
                                            <span className="badge">{mod.role}</span>
                                        </div>
                                        {roomData.isOwner && (
                                            <button
                                                type="button"
                                                className="btn icon-btn danger"
                                                onClick={() => handleRemoveMod(mod.userId)}
                                                title="Remove Moderator"
                                                style={{ padding: '4px', width: '24px', height: '24px' }}
                                            >
                                                <Icon icon="fa:times" width="12" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {(!roomData.moderators || roomData.moderators.length === 0) && (
                                    <p className="no-mods">No additional moderators assigned</p>
                                )}
                            </div>
                        </div>

                        {saveMessage && (
                            <div className="success-message">
                                <Icon icon="fa:check-circle" width="14" />
                                {saveMessage}
                            </div>
                        )}

                        {roomData.canEdit && (
                            <div className="modal-actions" style={{ marginBottom: '0' }}>
                                <button type="button" className="btn" onClick={onClose}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn primary" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}

                        {roomData.isOwner && (
                            <div className="danger-zone" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ color: '#ef4444', margin: '0 0 4px', fontSize: '14px' }}>Delete Room</h4>
                                        <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Permanently delete this room and all its data.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn danger"
                                        onClick={handleDeleteRoom}
                                        disabled={isSaving}
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: '#ef4444' }}
                                    >
                                        Delete Room
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
