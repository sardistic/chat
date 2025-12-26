"use client";

import { useState, useEffect, useRef } from "react";

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
    DISCORD_EMPLOYEE: { name: "Discord Staff", emoji: "👨‍💼" },
    PARTNERED_SERVER_OWNER: { name: "Partnered Server Owner", emoji: "🤝" },
    HYPESQUAD_EVENTS: { name: "HypeSquad Events", emoji: "🎪" },
    BUG_HUNTER_LEVEL_1: { name: "Bug Hunter", emoji: "🐛" },
    HOUSE_BRAVERY: { name: "HypeSquad Bravery", emoji: "🦁" },
    HOUSE_BRILLIANCE: { name: "HypeSquad Brilliance", emoji: "🦊" },
    HOUSE_BALANCE: { name: "HypeSquad Balance", emoji: "🐺" },
    EARLY_SUPPORTER: { name: "Early Supporter", emoji: "💎" },
    BUG_HUNTER_LEVEL_2: { name: "Bug Hunter Gold", emoji: "🐛" },
    VERIFIED_BOT_DEVELOPER: { name: "Verified Bot Developer", emoji: "🤖" },
    ACTIVE_DEVELOPER: { name: "Active Developer", emoji: "👨‍💻" },
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
        case 1: return { name: "Nitro Classic", emoji: "💜" };
        case 2: return { name: "Nitro", emoji: "🚀" };
        case 3: return { name: "Nitro Basic", emoji: "💙" };
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
            top: Math.min(position.y, window.innerHeight - 400),
            left: Math.min(position.x, window.innerWidth - 340),
        } : {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
        }),
    };

    return (
        <div className="profile-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.5)" }}>
            <div ref={modalRef} className="profile-modal" style={modalStyle}>
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
                        <div className="profile-status-dot" />
                    </div>
                </div>

                {/* Content */}
                <div className="profile-content">
                    {/* Badges */}
                    {(badges.length > 0 || premiumBadge) && (
                        <div className="profile-badges">
                            {premiumBadge && (
                                <span className="profile-badge" title={premiumBadge.name}>
                                    {premiumBadge.emoji}
                                </span>
                            )}
                            {badges.map((badge) => (
                                <span key={badge.key} className="profile-badge" title={badge.name}>
                                    {badge.emoji}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Name */}
                    <div className="profile-name-section">
                        <h2 className="profile-display-name">
                            {user.globalName || user.name || "Unknown User"}
                        </h2>
                        <p className="profile-username">
                            {isGuest ? (
                                <span style={{ color: "var(--text-muted)" }}>Guest</span>
                            ) : (
                                <>
                                    {user.username || user.name}
                                    {user.discriminator && user.discriminator !== "0" && (
                                        <span style={{ color: "var(--text-muted)" }}>#{user.discriminator}</span>
                                    )}
                                </>
                            )}
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="profile-divider" />

                    {/* Info sections */}
                    {user.customStatus && (
                        <div className="profile-section">
                            <h3 className="profile-section-title">STATUS</h3>
                            <p className="profile-section-content" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                💬 {user.customStatus}
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

                    {/* Email - only if verified */}
                    {user.email && user.verified && (
                        <div className="profile-section">
                            <h3 className="profile-section-title">EMAIL</h3>
                            <p className="profile-section-content">
                                {user.email} ✓
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
