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
    const [profile, setProfile] = useState({
        displayName: user?.name || '',
        bio: '', // Need to add bio to schema eventually, or store in metadata? For now just UI.
        avatarUrl: user?.image || ''
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { status } = useSession();

    // Fetch settings on mount
    useEffect(() => {
        if (isOpen && status === 'authenticated') {
            setLoading(true);
            fetch('/api/user/settings')
                .then(res => res.ok ? res.json() : {})
                .then(data => {
                    if (data.userId) { // If valid data
                        setSettings(prev => ({ ...prev, ...data }));
                    }
                })
                .catch(err => console.error("Failed to load settings:", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, status]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/user/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...settings, ...profile })
            });
            onClose();
        } catch (err) {
            console.error("Failed to save settings:", err);
        } finally {
            setSaving(false);
        }
    };

    // Background toggle component
    const BackgroundToggle = () => {
        const { backgroundType, setBackgroundType } = useBackground();
        return (
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={() => setBackgroundType(BACKGROUND_TYPES.STARMAP)}
                    style={{
                        flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer',
                        background: backgroundType === BACKGROUND_TYPES.STARMAP ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: backgroundType === BACKGROUND_TYPES.STARMAP ? '2px solid #5865F2' : '2px solid transparent',
                        textAlign: 'center', transition: 'all 0.2s',
                    }}
                >
                    <Icon icon="fa:star" width="20" style={{ color: backgroundType === BACKGROUND_TYPES.STARMAP ? '#5865F2' : '#666', marginBottom: '6px' }} />
                    <div style={{ fontSize: '13px', fontWeight: '500', color: backgroundType === BACKGROUND_TYPES.STARMAP ? 'white' : '#aaa' }}>Star Map</div>
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Floating particles</div>
                </button>
                <button
                    onClick={() => setBackgroundType(BACKGROUND_TYPES.GRID)}
                    style={{
                        flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer',
                        background: backgroundType === BACKGROUND_TYPES.GRID ? 'rgba(88, 101, 242, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: backgroundType === BACKGROUND_TYPES.GRID ? '2px solid #5865F2' : '2px solid transparent',
                        textAlign: 'center', transition: 'all 0.2s',
                    }}
                >
                    <Icon icon="fa:th" width="20" style={{ color: backgroundType === BACKGROUND_TYPES.GRID ? '#5865F2' : '#666', marginBottom: '6px' }} />
                    <div style={{ fontSize: '13px', fontWeight: '500', color: backgroundType === BACKGROUND_TYPES.GRID ? 'white' : '#aaa' }}>Dot Grid</div>
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Wave animation</div>
                </button>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="settings-modal-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div className="settings-modal" style={{
                background: '#1a1b1e', width: '500px', maxWidth: '90vw',
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

                    {/* Background Style */}
                    <section>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Background Style</h3>
                        <BackgroundToggle />
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
