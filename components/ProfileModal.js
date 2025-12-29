"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from '@iconify/react';
import { useSocket } from "@/lib/socket";

// Discord badge flags
const DISCORD_FLAGS = {
    DISCORD_EMPLOYEE: 1 << 0,
    PARTNERED_SERVER_OWNER: 1 << 1,
    HYPESQUAD_EVENTS: 1 << 2,
    BUG_HUNTER_LEVEL_1: 1 << 3,
    HOUSE_BRAVERY: 1 << 6,
    HOUSE_BRILLIANCE: 1 << 7,
    HOUSE_BALANCE: 1 << 8,
    EARLY_SUPPORTER: 1 << 9,
    BUG_HUNTER_LEVEL_2: 1 << 14,
    VERIFIED_BOT_DEVELOPER: 1 << 17,
    ACTIVE_DEVELOPER: 1 << 22,
};

// Badge display info
const BADGE_INFO = {
    DISCORD_EMPLOYEE: { name: "Discord Staff", icon: <Icon icon="fa:briefcase" width="14" /> },
    PARTNERED_SERVER_OWNER: { name: "Partnered Server Owner", icon: <Icon icon="fa:handshake-o" width="14" /> },
    HYPESQUAD_EVENTS: { name: "HypeSquad Events", icon: <Icon icon="fa:shield" width="14" /> },
    BUG_HUNTER_LEVEL_1: { name: "Bug Hunter", icon: <Icon icon="fa:bug" width="14" /> },
    HOUSE_BRAVERY: { name: "HypeSquad Bravery", icon: <Icon icon="fa:shield" width="14" color="#9C89F7" /> },
    HOUSE_BRILLIANCE: { name: "HypeSquad Brilliance", icon: <Icon icon="fa:shield" width="14" color="#F47B67" /> },
    HOUSE_BALANCE: { name: "HypeSquad Balance", icon: <Icon icon="fa:shield" width="14" color="#4FD1C5" /> },
    EARLY_SUPPORTER: { name: "Early Supporter", icon: <Icon icon="fa:star" width="14" /> },
    BUG_HUNTER_LEVEL_2: { name: "Bug Hunter Gold", icon: <Icon icon="fa:bug" width="14" color="#FCD34D" /> },
    VERIFIED_BOT_DEVELOPER: { name: "Verified Bot Developer", icon: <Icon icon="fa:code" width="14" /> },
    ACTIVE_DEVELOPER: { name: "Active Developer", icon: <Icon icon="fa:code" width="14" /> },
};

// Parse badges from public_flags
function getBadges(flags) {
    if (!flags) return [];
    const badges = [];
    for (const [key, value] of Object.entries(DISCORD_FLAGS)) {
        if (flags & value) {
            badges.push({ ...BADGE_INFO[key], key });
        }
    }
    return badges;
}

// Get premium badge
function getPremiumBadge(premiumType) {
    if (premiumType === 1) return { name: "Nitro Classic", icon: <Icon icon="fa:rocket" width="14" /> };
    if (premiumType === 2) return { name: "Nitro", icon: <Icon icon="fa:rocket" width="14" /> };
    if (premiumType === 3) return { name: "Nitro Basic", icon: <Icon icon="fa:rocket" width="14" /> };
    return null;
}

// Convert accent color integer to hex
function accentToHex(accent) {
    if (!accent) return null;
    return `#${accent.toString(16).padStart(6, '0')}`;
}

export default function ProfileModal({ user, isOpen, onClose, position }) {
    const modalRef = useRef(null);
    const { socket } = useSocket();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                onClose();
            }
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => { if (e.key === "Escape") onClose(); };
        if (isOpen) document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    const [activeTab, setActiveTab] = useState('info');
    const [stats, setStats] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    useEffect(() => {
        if (isOpen && user && user.id && socket) {
            setLoadingStats(true);
            socket.emit("fetch-profile-stats", { userId: user.id }, (response) => {
                if (response && !response.error) {
                    setStats(response.stats);
                    setConnectionStatus(response.status);
                }
                setLoadingStats(false);
            });
        }
    }, [isOpen, user, socket]);

    const formatTime = (seconds) => {
        if (!seconds) return "0h";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    if (!isOpen || !user) return null;

    const badges = getBadges(user.publicFlags);
    const premiumBadge = getPremiumBadge(user.premiumType);
    const accentColor = accentToHex(user.accentColor) || "var(--accent-primary)";
    const avatarUrl = user.image || user.avatar || `/api/avatar/${user.name}`;
    const isGuest = user.isGuest !== false && !user.discordId;
    const customStatus = user.customStatus;

    // Viewport-aware positioning
    const modalStyle = {
        position: "fixed",
        zIndex: 9999,
        background: "rgba(15, 16, 19, 0.95)", // Solid dark background
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        width: "300px",
        overflow: "hidden",
        ...(position ? {
            top: Math.min(position.y, window.innerHeight - 400),
            left: Math.min(position.x, window.innerWidth - 320),
        } : {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
        }),
    };

    const InfoChip = ({ label, value, icon, color }) => (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '6px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon icon={icon} width="10" /> {label}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: color || 'white' }}>{value}</div>
        </div>
    );

    return (
        <div className="profile-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose}>
            <div ref={modalRef} className="profile-modal" style={modalStyle} onClick={e => e.stopPropagation()}>
                {/* Thin colored top strip */}
                <div style={{ height: '4px', background: accentColor }} />

                {/* Header: Compact, side-by-side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `url(${avatarUrl}) center/cover`, border: `2px solid ${accentColor}` }} />
                        <div className={`profile-status-dot ${connectionStatus?.isOnline ? 'online' : 'offline'}`}
                            style={{ width: '12px', height: '12px', border: '2px solid #0f1013', position: 'absolute', bottom: 0, right: 0, background: connectionStatus?.isOnline ? '#3ba55d' : '#747f8d', borderRadius: '50%' }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.globalName || user.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {user.username || user.name || "User"}
                        </div>
                        {/* Badges Row */}
                        {(badges.length > 0 || premiumBadge) && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                {premiumBadge && <span title={premiumBadge.name} style={{ color: '#fff' }}>{premiumBadge.icon}</span>}
                                {badges.map(b => <span key={b.key} title={b.name} style={{ color: '#fff' }}>{b.icon}</span>)}
                            </div>
                        )}
                    </div>
                    {/* Tiny X button */}
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px', alignSelf: 'flex-start' }}>
                        <Icon icon="fa:times" width="12" />
                    </button>
                </div>

                {/* Quick Info Grid */}
                <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px' }}>
                    <InfoChip label="Type" value={isGuest ? "Guest" : "Member"} icon="fa:user" />
                    <InfoChip label="Status" value={connectionStatus?.isOnline ? "Online" : "Away"} icon="fa:circle" color={connectionStatus?.isOnline ? "var(--status-online)" : "var(--text-muted)"} />
                    <InfoChip label="Cam" value={stats?.camTimeSeconds > 0 ? formatTime(stats.camTimeSeconds) : "Off"} icon="fa:video-camera" />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 16px' }}>
                    {['Overview', 'Activity'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: '8px', background: 'none', border: 'none',
                                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                                borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div style={{ padding: '16px', minHeight: '120px' }}>
                    {activeTab === 'Overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {customStatus && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Status</span>
                                    {customStatus}
                                </div>
                            )}
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>About Me</div>
                                <div style={{ fontSize: '13px', lineHeight: '1.4', color: 'rgba(255,255,255,0.8)' }}>
                                    {isGuest ? "This is a guest user." : "No bio available."}
                                </div>
                            </div>
                            {!isGuest && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 'auto' }}>
                                    ID: <span style={{ fontFamily: 'monospace' }}>{user.discordId}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Activity' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <InfoChip label="Chat Points" value={stats?.chatPoints || 0} icon="fa:star" color="#FFD700" />
                            <InfoChip label="Messages" value={stats?.messagesSent || 0} icon="fa:comment" />
                            <InfoChip label="Emotes Sent" value={stats?.emotesGiven || 0} icon="fontelico:emo-wink" />
                            <InfoChip label="Time Online" value={formatTime(stats?.timeOnSiteSeconds || 0)} icon="fa:clock-o" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
