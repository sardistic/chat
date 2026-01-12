"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Icon } from '@iconify/react';
import { useSocket } from "@/lib/socket";
import { motion, useDragControls } from "framer-motion";


const TABS = [
    { id: 'info', label: 'Overview', icon: 'fa:user' },
    { id: 'stats', label: 'Activity', icon: 'fa:bar-chart' },
    { id: 'actions', label: 'Actions', icon: 'fa:bolt' },
];

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

export default function ProfileModal({
    user,
    isOpen,
    onClose,
    position,
    peerSettings = {},
    onUpdatePeerSettings = () => { },
    currentUser, // Local user state for role checks
    viewingUserRole // Fallback
}) {
    const { data: session } = useSession();
    // Use currentUser role if available (Guest Admin fix), else session, else fallback prop
    const effectiveRole = currentUser?.role || session?.user?.role || viewingUserRole || 'USER';
    const modalRef = useRef(null);
    const { socket } = useSocket();
    const dragControls = useDragControls();

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
    const { status } = useSession();

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

    // Check Block Status
    const [isBlocked, setIsBlocked] = useState(false);
    useEffect(() => {
        if (isOpen && user?.id && status === 'authenticated') {
            fetch('/api/user/block')
                .then(res => res.ok ? res.json() : [])
                .then(blockedIds => {
                    if (Array.isArray(blockedIds)) {
                        setIsBlocked(blockedIds.includes(user.id));
                    }
                })
                .catch(err => console.error("Failed to fetch blocks", err));
        }
    }, [isOpen, user?.id, status]);

    const handleBlockToggle = async () => {
        const action = isBlocked ? 'unblock' : 'block';
        try {
            await fetch('/api/user/block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetId: user.id, action })
            });
            onUpdatePeerSettings(user.id, { isBlocked: !isBlocked });
        } catch (e) {
            console.error("Block action failed", e);
        }
    };

    const handleMuteToggle = async () => {
        // 1. Update Local (Immediate)
        onUpdatePeerSettings(user.id, { isLocallyMuted: !isMuted });

        // 2. Persist to DB
        try {
            await fetch('/api/user/mute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetId: user.id, action: isMuted ? 'unmute' : 'mute' })
            });
        } catch (e) {
            console.error("Mute persistence failed", e);
        }
    };

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
    const avatarUrl = user.image || user.avatar || `/api/avatar/${user.name}${user.avatarSeed ? `?v=${user.avatarSeed}` : ''}`;
    const isGuest = user.isGuest !== false && !user.discordId;
    const customStatus = user.customStatus;

    // Viewport-aware positioning
    const modalStyle = {
        position: "fixed",
        zIndex: 9999,
        background: "var(--glass-bg-heavy)",
        backdropFilter: "var(--glass-blur-heavy)",
        border: "1px solid var(--glass-border)",
        borderRadius: "12px",
        boxShadow: "var(--glass-shadow)",
        width: "300px",
        overflow: "hidden",
        ...(position ? {
            top: Math.min(position.y, window.innerHeight - 400),
            left: Math.min(position.x, window.innerWidth - 320),
        } : {
            // Default to center-right if no position provided (fallback)
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
        }),
    };

    const InfoChip = ({ label, value, icon, color }) => (
        <div style={{ background: 'var(--glass-bg)', padding: '6px 8px', borderRadius: '6px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon icon={icon} width="10" /> {label}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: color || 'white' }}>{value}</div>
        </div>
    );

    // Get current settings for this user
    const userSettings = peerSettings[user.id]; // Can be undefined for non-peers or self
    const isSelf = false; // logic to detect self if needed, passed prop or compare IDs

    const handleVolumeChange = (e) => {
        if (user && user.id) {
            onUpdatePeerSettings(user.id, { volume: parseFloat(e.target.value) });
        }
    };

    return (
        <div className="profile-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose}>
            <motion.div
                ref={modalRef}
                className="profile-modal"
                drag
                dragControls={dragControls}
                dragListener={false}
                dragMomentum={false}
                dragElastic={0}
                style={modalStyle}
                onClick={e => e.stopPropagation()}
            >
                {/* Thin colored top strip */}
                <div
                    onPointerDown={(e) => dragControls.start(e)}
                    style={{ height: '12px', background: accentColor, cursor: 'grab' }}
                />

                {/* Header: Compact, side-by-side */}
                <div
                    onPointerDown={(e) => dragControls.start(e)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', position: 'relative', cursor: 'grab' }}
                >
                    <div style={{ position: 'relative' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `url(${avatarUrl}) center/cover`, border: `2px solid ${accentColor}` }} />
                        <div className={`profile-status-dot ${connectionStatus?.isOnline ? 'online' : 'offline'}`}
                            style={{ width: '12px', height: '12px', border: '2px solid #0f1013', position: 'absolute', bottom: 0, right: 0, background: connectionStatus?.isOnline ? '#3ba55d' : '#747f8d', borderRadius: '50%' }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.globalName || user.name} <span style={{ fontSize: '10px', color: 'gray' }}>({effectiveRole} to {user.role})</span>
                            {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                                <span style={{ fontSize: '10px', padding: '2px 4px', background: '#4f46e5', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '6px' }}>
                                    {user.role}
                                </span>
                            )}
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

                        {/* Persistent Controls - Quick Access */}
                        {userSettings && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button
                                    onClick={handleMuteToggle}
                                    className={`icon-btn ${userSettings.isLocallyMuted ? 'danger' : 'secondary'}`}
                                    title={userSettings.isLocallyMuted ? "Unmute" : "Mute"}
                                    style={{
                                        padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                        background: userSettings.isLocallyMuted ? 'rgba(248, 113, 113, 0.2)' : 'var(--glass-bg-hover)',
                                        color: userSettings.isLocallyMuted ? '#f87171' : 'rgba(255,255,255,0.7)',
                                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px'
                                    }}
                                >
                                    <Icon icon={userSettings.isLocallyMuted ? "fa:microphone-slash" : "fa:microphone"} width="12" />
                                    {userSettings.isLocallyMuted ? "Unmute" : "Mute"}
                                </button>
                                <button
                                    onClick={() => onUpdatePeerSettings(user.id, { isVideoHidden: !userSettings.isVideoHidden })}
                                    className={`icon-btn ${userSettings.isVideoHidden ? 'danger' : 'secondary'}`}
                                    title={userSettings.isVideoHidden ? "Show Cam" : "Hide Cam"}
                                    style={{
                                        padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                        background: userSettings.isVideoHidden ? 'rgba(248, 113, 113, 0.2)' : 'var(--glass-bg-hover)',
                                        color: userSettings.isVideoHidden ? '#f87171' : 'rgba(255,255,255,0.7)',
                                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px'
                                    }}
                                >
                                    <Icon icon={userSettings.isVideoHidden ? "fa:eye-slash" : "fa:video-camera"} width="12" />
                                    {userSettings.isVideoHidden ? "Show" : "Hide"}
                                </button>
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
                <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 16px' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1, padding: '8px', background: 'none', border: 'none',
                                color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                                borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            <Icon icon={tab.icon} width="12" />
                            {tab.label}
                        </button>
                    ))}
                </div>


                {/* Tab Content */}
                <div style={{ padding: '16px', minHeight: '120px' }}>
                    {activeTab === 'info' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ background: 'var(--glass-bg)', padding: '8px', borderRadius: '6px', fontSize: '12px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Status</span>
                                {customStatus}
                            </div>

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

                    {activeTab === 'stats' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <InfoChip label="Chat Points" value={stats?.chatPoints || 0} icon="fa:star" color="#FFD700" />
                            <InfoChip label="Messages" value={stats?.messagesSent || 0} icon="fa:comment" />
                            <InfoChip label="Emotes Sent" value={stats?.emotesGiven || 0} icon="fontelico:emo-wink" />
                            <InfoChip label="Time Online" value={formatTime(stats?.timeOnSiteSeconds || 0)} icon="fa:clock-o" />
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="menu-label" style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Available Actions</div>

                            {/* Peer Controls (Only if it's a peer we have settings for) */}
                            {userSettings && (
                                <>
                                    {/* Volume */}
                                    <div style={{ background: 'var(--glass-bg)', padding: '8px', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                                            <span>Volume</span>
                                            <span>{Math.round((userSettings.volume ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={userSettings.volume ?? 1}
                                            onChange={handleVolumeChange}
                                            style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                                        />
                                    </div>

                                    {/* Toggles */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <button
                                            onClick={handleBlockToggle}
                                            className={`btn ${isBlocked ? 'secondary' : 'danger'}`}
                                            style={{ justifyContent: 'center' }}
                                        >
                                            <Icon icon="fa:ban" width="14" /> {isBlocked ? "Unblock" : "Block"}
                                        </button>

                                        <button className="btn secondary" style={{ justifyContent: 'center' }}>
                                            <Icon icon="fa:flag" width="14" /> Report
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Fallback for non-peers (e.g. self or chat-only): Simple Report Button */}
                            {!userSettings && (
                                <button className="btn secondary" style={{ justifyContent: 'center', width: '100%' }}>
                                    <Icon icon="fa:flag" width="14" /> Report User
                                </button>
                            )}

                            {/* Admin Actions Section - Always Visible for Admins */}


                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

                            {/* Admin/Mod Actions */}
                            {(effectiveRole === 'ADMIN' || effectiveRole === 'MODERATOR' || effectiveRole === 'OWNER') && (
                                <>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Mod Actions</div>

                                    {/* Shadow Mute */}
                                    <button
                                        className="btn secondary"
                                        style={{ justifyContent: 'center' }}
                                        onClick={() => {
                                            console.log('[ModAction] Shadow Mute clicked. Target:', user, 'Socket:', !!socket);
                                            if (!socket) {
                                                alert('No socket connection!');
                                                return;
                                            }
                                            // Support both ID (for DB users) and name (for IRC/guests)
                                            const targetId = user.id || null;
                                            const targetName = user.name;
                                            if (!targetId && !targetName) {
                                                alert('Cannot identify target user');
                                                return;
                                            }
                                            socket.emit('mod-shadow-mute', {
                                                targetUserId: targetId,
                                                targetUserName: targetName,
                                                mute: true
                                            });
                                            alert('User shadow muted. Their messages will only be visible to mods.');
                                        }}
                                    >
                                        <Icon icon="fa:eye-slash" width="14" /> Shadow Mute
                                    </button>

                                    {/* Wipe Messages */}
                                    <button
                                        className="btn secondary"
                                        style={{ justifyContent: 'center', marginTop: '4px' }}
                                        onClick={() => {
                                            console.log('[ModAction] Wipe Messages clicked. Target:', user, 'Socket:', !!socket);
                                            if (!socket) {
                                                alert('No socket connection!');
                                                return;
                                            }
                                            // Support both ID (for DB users) and name (for IRC/guests)
                                            const targetId = user.id || null;
                                            const targetName = user.name;
                                            if (!targetId && !targetName) {
                                                alert('Cannot identify target user');
                                                return;
                                            }
                                            socket.emit('mod-wipe-messages', {
                                                targetUserId: targetId,
                                                targetUserName: targetName
                                            });
                                            alert('Messages wiped (hidden from non-mods).');
                                        }}
                                    >
                                        <Icon icon="fa:eraser" width="14" /> Wipe Messages
                                    </button>

                                    {/* Force Cam Down */}
                                    <button
                                        className="btn secondary"
                                        style={{ justifyContent: 'center', marginTop: '4px' }}
                                        onClick={() => {
                                            socket?.emit('mod-force-cam-down', {
                                                targetSocketId: user.socketId,
                                                banMinutes: 0
                                            });
                                            alert('User camera disabled.');
                                        }}
                                    >
                                        <Icon icon="fa:video-camera" width="14" /> Force Cam Down
                                    </button>

                                    {/* Force Cam Down + Ban */}
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                        {[1, 5, 15].map(mins => (
                                            <button
                                                key={mins}
                                                className="btn danger"
                                                style={{ flex: 1, justifyContent: 'center', fontSize: '11px', padding: '6px' }}
                                                onClick={() => {
                                                    socket?.emit('mod-force-cam-down', {
                                                        targetSocketId: user.socketId,
                                                        banMinutes: mins
                                                    });
                                                    alert(`Camera disabled for ${mins} minutes.`);
                                                }}
                                            >
                                                Cam Ban {mins}m
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />

                                    <button
                                        className="btn danger"
                                        style={{ justifyContent: 'center' }}
                                        onClick={async () => {
                                            if (confirm("Kick this user?")) {
                                                const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR' || session?.user?.role === 'OWNER';
                                                if (!isAdmin) return;
                                                await fetch('/api/admin/actions', {
                                                    method: 'POST', body: JSON.stringify({ userId: user.id, action: 'KICK' })
                                                });
                                                onClose();
                                            }
                                        }}
                                    >
                                        <Icon icon="fa:ban" width="14" /> Kick User
                                    </button>
                                    <button
                                        className="btn danger"
                                        style={{ justifyContent: 'center', marginTop: '4px' }}
                                        onClick={async () => {
                                            if (confirm("Ban this user?")) {
                                                const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR' || session?.user?.role === 'OWNER';
                                                if (!isAdmin) return;
                                                await fetch('/api/admin/actions', {
                                                    method: 'POST', body: JSON.stringify({ userId: user.id, action: 'BAN', value: true })
                                                });
                                                onClose();
                                            }
                                        }}
                                    >
                                        <Icon icon="fa:gavel" width="14" /> Ban User
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </motion.div >
        </div >
    );
}


function InfoChip({ label, value, icon, color }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Icon icon={icon} width="12" color={color} />
                {label}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {value}
            </div>
        </div>
    );
}
