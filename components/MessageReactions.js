"use client";

import { useState } from 'react';

const EMOJI_OPTIONS = ['❤️', '🔥', '😂', '😮', '👏', '🎉', '👍', '👎'];

export default function MessageReactions({ messageId, reactions = {}, onReact, onUnreact, currentUserId, center = false }) {
    const [showPicker, setShowPicker] = useState(false);

    const handleEmojiClick = (emoji) => {
        const reaction = reactions[emoji];
        if (reaction && reaction.users?.includes(currentUserId)) {
            // User already reacted with this emoji - remove it
            onUnreact(messageId, emoji);
        } else {
            // Add reaction
            onReact(messageId, emoji);
        }
        setShowPicker(false);
    };

    const hasReactions = Object.keys(reactions).length > 0;

    return (
        <div className="message-reactions" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            alignItems: 'center',
            justifyContent: center ? 'center' : 'flex-start',
            marginTop: hasReactions ? '2px' : '0',
            marginLeft: '0', // Align with message content
            width: '100%'
        }}>
            {/* Existing reaction badges */}
            {Object.entries(reactions).map(([emoji, data]) => {
                const hasReacted = data.users?.includes(currentUserId);
                return (
                    <button
                        key={emoji}
                        onClick={() => handleEmojiClick(emoji)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: hasReacted ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.1)',
                            border: hasReacted ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                            borderRadius: '12px',
                            padding: '2px 8px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                        title={`${data.count} reaction${data.count !== 1 ? 's' : ''}`}
                    >
                        <span>{emoji}</span>
                        <span style={{ color: hasReacted ? '#a5b4fc' : '#9ca3af', fontSize: '11px' }}>
                            {data.count}
                        </span>
                    </button>
                );
            })}

            {/* Add reaction button */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="add-reaction-btn"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '2px 6px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        opacity: showPicker ? 1 : 0,
                        transition: 'opacity 0.15s ease',
                        color: '#9ca3af'
                    }}
                    title="Add reaction"
                >
                    {showPicker ? '✕' : '😊+'}
                </button>

                {/* Emoji picker dropdown */}
                {showPicker && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        background: 'rgba(30, 30, 40, 0.95)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        gap: '2px',
                        zIndex: 100,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                    }}>
                        {EMOJI_OPTIONS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleEmojiClick(emoji)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '18px',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.1s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Hover style for add button */}
            <style jsx>{`
                .message-reactions:hover .add-reaction-btn {
                    opacity: 0.7 !important;
                }
                .add-reaction-btn:hover {
                    opacity: 1 !important;
                    background: rgba(255,255,255,0.1) !important;
                }
            `}</style>
        </div>
    );
}
