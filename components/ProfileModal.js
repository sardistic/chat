"use client";

import { useState, useEffect, useRef } from "react";
import {
    IconMessage, IconInfoCircle, IconBrandDiscord, IconMail,
    IconRocket, IconDiamond, IconStar, IconMessagedots,
    IconClock, IconVideo, IconMoodSmile, IconBug,
    IconBriefcase, IconUsers, IconTent, IconShieldCheck,
    IconCode
} from '@tabler/icons-react';

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
    DISCORD_EMPLOYEE: { name: "Discord Staff", icon: <IconBriefcase size={16} /> },
    PARTNERED_SERVER_OWNER: { name: "Partnered Server Owner", icon: <IconUsers size={16} /> },
    HYPESQUAD_EVENTS: { name: "HypeSquad Events", icon: <IconTent size={16} /> },
    BUG_HUNTER_LEVEL_1: { name: "Bug Hunter", icon: <IconBug size={16} /> },
    HOUSE_BRAVERY: { name: "HypeSquad Bravery", icon: <IconShieldCheck size={16} color="#9C89F7" /> },
    HOUSE_BRILLIANCE: { name: "HypeSquad Brilliance", icon: <IconShieldCheck size={16} color="#F47B67" /> },
    HOUSE_BALANCE: { name: "HypeSquad Balance", icon: <IconShieldCheck size={16} color="#4FD1C5" /> },
    EARLY_SUPPORTER: { name: "Early Supporter", icon: <IconDiamond size={16} /> },
    BUG_HUNTER_LEVEL_2: { name: "Bug Hunter Gold", icon: <IconBug size={16} color="#FCD34D" /> },
    VERIFIED_BOT_DEVELOPER: { name: "Verified Bot Developer", icon: <IconCode size={16} /> },
    ACTIVE_DEVELOPER: { name: "Active Developer", icon: <IconCode size={16} /> },
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
    switch (premiumType) {
        case 1: return { name: "Nitro Classic", icon: <IconRocket size={16} /> };
        case 2: return { name: "Nitro", icon: <IconRocket size={16} /> };
        case 3: return { name: "Nitro Basic", icon: <IconStar size={16} /> };
        default: return null;
    }
}

// Convert accent color integer to hex
function accentToHex(accent) {
    if (!accent) return null;
    return `#${accent.toString(16).padStart(6, '0')}`;
}

export default function ProfileModal({ user, isOpen, onClose, position }) {
    const modalRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
        }
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    const [activeTab, setActiveTab] = useState('info');
    const [stats, setStats] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // We need socket to fetch stats
    // Assuming socket is available via global context or passed prop (it's not passed currently)
    // We can try to import useSocket, but ProfileModal is a child component.
    // Better to just fetch via API or if we have access to socket.
    // The previous implementation of MainApp uses useSocket but doesn't pass it here.
    // Let's import useSocket hook.
    const { socket } = require("@/lib/socket").useSocket();

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

    // Format utility
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
    const accentColor = accentToHex(user.accentColor) || "#5865F2";
    const bannerUrl = user.banner;
    const avatarUrl = user.image || user.avatar || `/api/avatar/${user.name}`;
    const isGuest = user.isGuest !== false && !user.discordId;

    // Calculate position (try to show near click but stay in viewport)
    const modalStyle = {
        position: "fixed",
        zIndex: 9999,
        ...(position ? {
            top: Math.min(position.y, window.innerHeight - 450),
            left: Math.min(position.x, window.innerWidth - 340),
        } : {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
        }),
    };

    return (
        <div className="profile-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
            <div ref={modalRef} className="profile-modal" style={modalStyle} onClick={e => e.stopPropagation()}>
                {/* Banner */}
                <div
                    className="profile-banner"
                    style={{
                        height: "100px",
                        borderRadius: "12px 12px 0 0",
                        background: bannerUrl
                            ? `url(${bannerUrl}) center/cover`
                            : `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}88 100%)`,
                    }}
                />

                {/* Avatar */}
                <div className="profile-avatar-wrapper">
                    <div
                        className="profile-avatar"
                        style={{
                            backgroundImage: `url(${avatarUrl})`,
                        }}
                    >
                        {/* Online status dot */}
                        <div className={`profile-status-dot ${connectionStatus?.isOnline ? 'online' : 'offline'}`}
                            title={connectionStatus?.isOnline ? "Online" : "Offline"}
                            style={{ background: connectionStatus?.isOnline ? '#3ba55d' : '#747f8d' }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="profile-content">
                    {/* Badges */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', minHeight: '24px' }}>
                        {premiumBadge && (
                            <span className="profile-badge" title={premiumBadge.name}>
                                {premiumBadge.icon}
                            </span>
                        )}
                        {badges.map((badge) => (
                            <span key={badge.key} className="profile-badge" title={badge.name}>
                                {badge.icon}
                            </span>
                        ))}
                    </div>

                    {/* Name */}
                    <div className="profile-name-section">
                        <h2 className="profile-display-name">
                            {user.globalName || user.name || "Unknown User"}
                        </h2>
                        <p className="profile-username">
                            {user.username || user.name}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '16px', margin: '16px 0 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                            onClick={() => setActiveTab('info')}
                            style={{
                                background: 'none', border: 'none', color: activeTab === 'info' ? 'white' : '#888',
                                borderBottom: activeTab === 'info' ? '2px solid white' : 'none', padding: '4px 8px', cursor: 'pointer'
                            }}
                        >
                            User Info
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            style={{
                                background: 'none', border: 'none', color: activeTab === 'stats' ? 'white' : '#888',
                                borderBottom: activeTab === 'stats' ? '2px solid white' : 'none', padding: '4px 8px', cursor: 'pointer'
                            }}
                        >
                            Stats & Points
                        </button>
                    </div>

                    {activeTab === 'info' ? (
                        <>
                            {/* Info sections */}
                            {user.customStatus && (
                                <div className="profile-section">
                                    <h3 className="profile-section-title">STATUS</h3>
                                    <p className="profile-section-content" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <IconMessagedots size={14} style={{ opacity: 0.7 }} /> {user.customStatus}
                                    </p>
                                </div>
                            )}

                            <div className="profile-section">
                                <h3 className="profile-section-title">ABOUT ME</h3>
                                <p className="profile-section-content">
                                    {isGuest
                                        ? "This is a guest user."
                                        : "No bio available"
                                    }
                                </p>
                            </div>

                            {/* Member since - only for Discord users */}
                            {!isGuest && user.discordId && (
                                <div className="profile-section">
                                    <h3 className="profile-section-title">DISCORD ID</h3>
                                    <p className="profile-section-content" style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                                        {user.discordId}
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Stats Tab */
                        <div className="profile-section">
                            {loadingStats ? (
                                <div style={{ fontSize: '13px', color: '#888', padding: '20px', textAlign: 'center' }}>Loading stats...</div>
                            ) : stats ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FCD34D' }}>{stats.chatPoints}</div>
                                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Chat Points</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatTime(stats.timeOnSiteSeconds)}</div>
                                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Time Online</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.messagesSent}</div>
                                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Messages</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatTime(stats.camTimeSeconds)}</div>
                                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Cam Time</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.emotesGiven}</div>
                                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Emotes Given</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.emotesReceived}</div>
                                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Emotes Recv</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: '13px', color: '#888' }}>No stats available.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
