"use client";

import { useState, useEffect } from "react";
import { Icon } from '@iconify/react';
import { useSocket } from "@/lib/socket";
import { useSession } from "next-auth/react";
import { useBackground, BACKGROUND_TYPES } from './Background';

export default function SettingsModal({ isOpen, onClose, user }) {
    const [settings, setSettings] = useState({
        volume: 1.0,
        autoDeafen: false,
        hideMuted: true,
        dmEnabled: true,
        theme: 'dark'
    });
    const [nickname, setNickname] = useState(user?.globalName || user?.name || '');
    const [avatarSeed, setAvatarSeed] = useState(Math.floor(Math.random() * 999999));
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { status, data: session } = useSession();

    // Fetch settings on mount
    useEffect(() => {
        if (isOpen && status === 'authenticated') {
            setLoading(true);
            fetch('/api/user/settings')
                .then(res => res.ok ? res.json() : {})
                .then(data => {
                    if (data.userId) {
                        setSettings(prev => ({ ...prev, ...data }));
                        if (data.nickname) setNickname(data.nickname);
                        if (data.avatarSeed) setAvatarSeed(data.avatarSeed);
                    }
                })
                .catch(err => console.error("Failed to load settings:", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, status]);

    // Update nickname when user changes
    useEffect(() => {
        if (user) {
            setNickname(user.globalName || user.name || '');
        }
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/user/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...settings,
                    nickname,
                    avatarSeed
                })
            });
            onClose();
        } catch (err) {
            console.error("Failed to save settings:", err);
        } finally {
            setSaving(false);
        }
    };

    const rollRandomAvatar = () => {
        setAvatarSeed(Math.floor(Math.random() * 999999));
    };

    // Background toggle component
    const BackgroundToggle = () => {
        const { backgroundType, setBackgroundType } = useBackground();
        return (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setBackgroundType(BACKGROUND_TYPES.STARMAP)}
                    style={{
                        flex: '1 1 30%', padding: '12px', borderRadius: '10px', cursor: 'pointer',
                        background: backgroundType === BACKGROUND_TYPES.STARMAP ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: backgroundType === BACKGROUND_TYPES.STARMAP ? '2px solid #5865F2' : '2px solid transparent',
                        textAlign: 'center', transition: 'all 0.2s',
                    }}
                >
                    <Icon icon="fa:star" width="18" style={{ color: backgroundType === BACKGROUND_TYPES.STARMAP ? '#5865F2' : '#666', marginBottom: '4px' }} />
                    <div style={{ fontSize: '12px', fontWeight: '500', color: backgroundType === BACKGROUND_TYPES.STARMAP ? 'white' : '#aaa' }}>Star Map</div>
                    <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>Particles</div>
                </button>
                <button
                    onClick={() => setBackgroundType(BACKGROUND_TYPES.GRID)}
                    style={{
                        flex: '1 1 30%', padding: '12px', borderRadius: '10px', cursor: 'pointer',
                        background: backgroundType === BACKGROUND_TYPES.GRID ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: backgroundType === BACKGROUND_TYPES.GRID ? '2px solid #5865F2' : '2px solid transparent',
                        textAlign: 'center', transition: 'all 0.2s',
                    }}
                >
                    <Icon icon="fa:th" width="18" style={{ color: backgroundType === BACKGROUND_TYPES.GRID ? '#5865F2' : '#666', marginBottom: '4px' }} />
                    <div style={{ fontSize: '12px', fontWeight: '500', color: backgroundType === BACKGROUND_TYPES.GRID ? 'white' : '#aaa' }}>Dot Grid</div>
                    <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>Animated</div>
                </button>
                <button
                    onClick={() => setBackgroundType(BACKGROUND_TYPES.STATIC)}
                    style={{
                        flex: '1 1 30%', padding: '12px', borderRadius: '10px', cursor: 'pointer',
                        background: backgroundType === BACKGROUND_TYPES.STATIC ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: backgroundType === BACKGROUND_TYPES.STATIC ? '2px solid #5865F2' : '2px solid transparent',
                        textAlign: 'center', transition: 'all 0.2s',
                    }}
                >
                    <Icon icon="fa:stop" width="18" style={{ color: backgroundType === BACKGROUND_TYPES.STATIC ? '#5865F2' : '#666', marginBottom: '4px' }} />
                    <div style={{ fontSize: '12px', fontWeight: '500', color: backgroundType === BACKGROUND_TYPES.STATIC ? 'white' : '#aaa' }}>Static</div>
                    <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>No Animation</div>
                </button>
            </div>
        );
    };

    if (!isOpen) return null;

    // Generate avatar URL from seed
    const avatarUrl = session?.user?.image || `/api/avatar/${avatarSeed}`;

    return (
        <div className="settings-modal-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div className="settings-modal" style={{
                background: '#1a1b1e', width: '500px', maxWidth: '90vw',
                maxHeight: '90vh', overflowY: 'auto',
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Settings</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                        <Icon icon="fa:times" />
                    </button>
                </div>

                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Profile Section */}
                    <section>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Profile</h3>

                        {/* Avatar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ position: 'relative' }}>
                                <img
                                    src={avatarUrl}
                                    alt="Avatar"
                                    style={{
                                        width: '80px', height: '80px', borderRadius: '50%',
                                        border: '3px solid rgba(255,255,255,0.1)',
                                        objectFit: 'cover'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button
                                    onClick={rollRandomAvatar}
                                    style={{
                                        padding: '8px 16px', borderRadius: '6px',
                                        border: 'none', background: 'rgba(88, 101, 242, 0.2)',
                                        color: '#5865F2', fontWeight: '500', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Icon icon="fa:random" width="14" />
                                    Roll Random Avatar
                                </button>
                                <div style={{ fontSize: '11px', color: '#666' }}>
                                    {session?.user?.image ? 'Using Discord avatar' : `Seed: ${avatarSeed}`}
                                </div>
                            </div>
                        </div>

                        {/* Nickname */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Nickname</label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={e => setNickname(e.target.value)}
                                placeholder="Enter your nickname"
                                maxLength={32}
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)',
                                    color: 'white', fontSize: '14px', outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                This is how other users will see you
                            </div>
                        </div>
                    </section>

                    {/* Background Style */}
                    <section>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Background Style</h3>
                        <BackgroundToggle />
                    </section>

                    {/* Audio Settings */}
                    <section>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Audio & Video</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '500' }}>Master Volume</div>
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Global volume for all users</div>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={settings.volume}
                                    onChange={e => setSettings({ ...settings, volume: parseFloat(e.target.value) })}
                                    style={{ width: '120px' }}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Privacy Settings */}
                    <section>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Privacy</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                <div>
                                    <div style={{ fontWeight: '500' }}>Hide Muted Users</div>
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Don't show video/chat from muted users</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.hideMuted}
                                    onChange={e => setSettings({ ...settings, hideMuted: e.target.checked })}
                                />
                            </label>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

            </div>
        </div>
    );
}
