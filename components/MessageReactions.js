"use client";

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from './EmojiPicker';

const EMOJI_OPTIONS = ['❤️', '🔥', '😂', '😮', '👏', '🎉', '👍', '👎'];

export default function MessageReactions({ messageId, reactions = {}, onReact, onUnreact, currentUserId, center = false, emotes }) {
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

    const hasReactions = Object.entries(reactions).length > 0;

    return (
        <div className="message-reactions-container" style={{ position: 'relative' }}>
            {/* Existing Reactions (Only render if there are any) */}
            {hasReactions && (
                <div className="reactions-list" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    alignItems: 'center',
                    justifyContent: center ? 'center' : 'flex-start',
                    marginTop: '2px',
                    width: '100%'
                }}>
                    {Object.entries(reactions).map(([emoji, data]) => {
                        const isMe = data.users?.includes(currentUserId);
                        return (
                            <button
                                key={emoji}
                                onClick={() => handleEmojiClick(emoji)}
                                className={`reaction-badge ${isMe ? 'active' : ''}`}
                                style={{
                                    background: isMe ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: isMe ? '1px solid rgba(var(--primary-rgb), 0.3)' : '1px solid transparent',
                                    borderRadius: '12px',
                                    padding: '2px 6px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <span>
                                    {emotes?.has(emoji) ? (
                                        <img
                                            src={emotes.get(emoji)}
                                            alt={emoji}
                                            style={{ height: '16px', width: 'auto', verticalAlign: 'middle', display: 'inline-block' }}
                                        />
                                    ) : (
                                        emoji
                                    )}
                                </span>
                                <span style={{ opacity: 0.7, fontSize: '10px' }}>{data.count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Add Reaction Button (Floating Right, Visible on Hover of parent row) */}
            <div className="reaction-trigger" style={{
                position: 'absolute',
                right: '0',
                top: hasReactions ? '-20px' : '-24px', // Adjust based on message height? A bit hacky but works for right-align
                // Actually, let's put it top-right of the CONTAINER, which is below message.
                // Better: The user wants it "to the right of chat".
                // If this component is below the message, absolute positioning relative to THIS component won't put it next to text easily unless negative top.
                // Let's rely on ChatPanel passing a class or we style it here.
                // Assuming parent .message-row has relative positioning.
                // We'll trust the user wants it to the right. 
                // Let's try formatting it as an inline absolute element.
                transform: 'translateY(-100%)', // Move up to message line
                paddingLeft: '8px'
            }}>
                <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="reaction-add-btn"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                    }}
                    title="Add reaction"
                >
                    <Icon icon="mdi:emoticon-plus-outline" width="16" />
                </button>

                {/* Emoji Picker Popover */}
                <AnimatePresence>
                    {showPicker && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            style={{
                                position: 'absolute',
                                bottom: '100%',
                                right: 0,
                                zIndex: 50,
                                marginBottom: '8px'
                            }}
                        >
                            <EmojiPicker
                                onSelect={(emoji) => {
                                    handleEmojiClick(emoji);
                                }}
                                onClose={() => setShowPicker(false)}
                                emotes={emotes}
                                style={{ width: '280px', height: '350px' }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
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
                /* Default state for the button */
                :global(.reaction-add-btn) {
                    opacity: 0;
                    transition: opacity 0.2s;
                }
            `}</style>
        </div>
    );
}
