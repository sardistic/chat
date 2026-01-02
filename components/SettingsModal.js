"use client";

import { useState, useEffect } from "react";
import { Icon } from '@iconify/react';
import { useSocket } from "@/lib/socket";

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

    // Fetch settings on mount
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetch('/api/user/settings')
                .then(res => res.json())
                .then(data => {
                    if (data.userId) { // If valid data
                        setSettings(prev => ({ ...prev, ...data }));
                    }
                })
                .catch(err => console.error("Failed to load settings:", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

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
