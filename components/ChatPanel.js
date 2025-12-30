"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useChat } from '@/hooks/useChat';
import MessageContent from './MessageContent';
import GifPicker from './GifPicker';

// Group messages from the same sender within 5 minutes
function groupMessages(messages) {
    const groups = [];
    let currentGroup = null;

    messages.forEach((msg, index) => {
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const isSameSender = prevMsg && prevMsg.sender === msg.sender;
        const isWithinTimeWindow = prevMsg &&
            (new Date(msg.timestamp) - new Date(prevMsg.timestamp)) < 5 * 60 * 1000; // 5 minutes

        if (isSameSender && isWithinTimeWindow && currentGroup) {
            // Add to current group
            currentGroup.messages.push(msg);
        } else {
            // Start new group
            currentGroup = {
                sender: msg.sender,
                senderColor: msg.senderColor,
                senderAvatar: msg.senderAvatar,
                timestamp: msg.timestamp,
                messages: [msg],
            };
            groups.push(currentGroup);
        }
    });

    return groups;
}

export default function ChatPanel({ roomId, user, users = [], ircUsers = [], onUserClick = () => { } }) {
    const { messages, sendMessage, isLoading, typingUsers, handleTyping } = useChat(roomId, user);
    const [inputValue, setInputValue] = useState('');
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    const [gifQuery, setGifQuery] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Group messages for Discord-style display
    const messageGroups = useMemo(() => groupMessages(messages), [messages]);

    // Combine web users and IRC users for mentions
    const allUsers = [
        ...users.map(u => ({ name: u.name || u.user?.name, type: 'web' })),
        ...ircUsers.map(u => ({ name: u.nick || u.name, type: 'irc' }))
    ].filter(u => u.name && u.name !== user?.name);

    // Filter users based on mention query
    const filteredMentions = mentionQuery
        ? allUsers.filter(u => u.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
        : allUsers;

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingUsers]);

    // Reset mention selection when filtered list changes
    useEffect(() => {
        setSelectedMentionIndex(0);
    }, [filteredMentions.length]);

    const handleSend = () => {
        if (inputValue.trim()) {
            sendMessage(inputValue);
            setInputValue('');
            setShowMentions(false);
            setShowGifPicker(false);
        }
    };

    const insertMention = (username) => {
        const cursorPos = inputRef.current?.selectionStart || inputValue.length;
        const textBeforeCursor = inputValue.slice(0, cursorPos);
        const textAfterCursor = inputValue.slice(cursorPos);

        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const newValue = textBeforeCursor.slice(0, lastAtIndex) + `@${username} ` + textAfterCursor;
            setInputValue(newValue);
        }

        setShowMentions(false);
        setMentionQuery('');
        inputRef.current?.focus();
    };

    const sendingRef = useRef(false);

    const handleGifSelect = (gifUrl) => {
        if (sendingRef.current) return;
        sendingRef.current = true;

        sendMessage(gifUrl);
        setShowGifPicker(false);
        setGifQuery('');
        setInputValue('');

        // Reset lock after short delay
        setTimeout(() => {
            sendingRef.current = false;
        }, 500);
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        handleTyping();

        // Check for /gif command
        const gifMatch = value.match(/^\/gif\s+(.+)$/i);
        if (gifMatch) {
            setShowGifPicker(true);
            setGifQuery(gifMatch[1]);
            setShowMentions(false);
        } else if (value.startsWith('/gif')) {
            setShowGifPicker(true);
            setGifQuery('');
            setShowMentions(false);
        } else {
            // Check for :word pattern (like Discord emoji picker)
            const colonMatch = value.match(/:(\w+)$/);
            if (colonMatch && colonMatch[1].length >= 1) {
                setShowGifPicker(true);
                setGifQuery(colonMatch[1]);
                setShowMentions(false);
            } else {
                setShowGifPicker(false);
            }
        }

        // Check for @ mentions (only if not in gif mode)
        if (!value.startsWith('/gif')) {
            const cursorPos = e.target.selectionStart;
            const textBeforeCursor = value.slice(0, cursorPos);
            const lastAtIndex = textBeforeCursor.lastIndexOf('@');

            if (lastAtIndex !== -1) {
                const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
                if ((lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === ' ') && !textAfterAt.includes(' ')) {
                    setShowMentions(true);
                    setMentionQuery(textAfterAt);
                } else {
                    setShowMentions(false);
                }
            } else {
                setShowMentions(false);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (showMentions && filteredMentions.length > 0) {
            if (e.key === 'Tab' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev + 1) % filteredMentions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(filteredMentions[selectedMentionIndex].name);
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
        } else if (e.key === 'Escape' && showGifPicker) {
            setShowGifPicker(false);
            setInputValue('');
        } else if (e.key === 'Enter' && !e.shiftKey && !showGifPicker) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="msgs" style={{ padding: '16px', overflowX: 'hidden', overflowY: 'auto' }}>
                {messages.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '32px',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic'
                    }}>
                        No messages yet. Start the conversation!
                    </div>
                )}

                {messageGroups.map((group, groupIndex) => (
                    <div
                        key={`group-${groupIndex}`}
                        className="message-group"
                        style={{
                            display: 'flex',
                            gap: '12px',
                            marginBottom: '16px',
                            padding: '4px 0',
                        }}
                    >
                        {/* Avatar */}
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: group.senderColor || '#5865F2',
                            flexShrink: 0,
                            overflow: 'hidden',
                            cursor: 'pointer'
                        }}
                            onClick={(e) => {
                                e.stopPropagation();
                                const foundUser = users.find(u => u.name === group.sender) ||
                                    ircUsers.find(u => u.name === group.sender) ||
                                    // Fallback minimal object if not found (e.g. offline user)
                                    { name: group.sender, avatar: group.senderAvatar, color: group.senderColor };
                                onUserClick(foundUser, e);
                            }}>
                            <img
                                src={group.senderAvatar || `/api/avatar/${group.sender}`}
                                alt={group.sender}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:16px;font-weight:bold;color:white">${group.sender?.charAt(0)?.toUpperCase() || '?'}</span>`;
                                }}
                            />
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Header: Username + Timestamp */}
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                                <span style={{
                                    fontWeight: '600',
                                    color: group.senderColor || 'var(--text-primary)',
                                    fontSize: '15px'
                                }}>
                                    {group.sender}
                                </span>
                                <span style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                }}>
                                    {formatTime(group.timestamp)}
                                </span>
                            </div>

                            {/* Messages */}
                            {group.messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    style={{
                                        marginBottom: '4px',
                                        lineHeight: '1.4',
                                    }}
                                >
                                    <MessageContent text={msg.text} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {typingUsers.length > 0 && (
                    <div style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                        padding: '8px 0',
                    }}>
                        {typingUsers.join(', ')} is typing...
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="input-area" style={{ position: 'relative', padding: '0 16px 16px' }}>
                {/* GIF Picker with search */}
                {showGifPicker && (
                    <div style={{
                        background: 'var(--bg-tertiary)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '8px',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <input
                                type="text"
                                placeholder="Search GIFs..."
                                value={gifQuery}
                                onChange={(e) => setGifQuery(e.target.value)}
                                autoFocus
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <GifPicker
                            query={gifQuery}
                            onSelect={handleGifSelect}
                            onClose={() => { setShowGifPicker(false); setGifQuery(''); }}
                        />
                    </div>
                )}

                {/* Mention Dropdown */}
                {showMentions && filteredMentions.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '16px',
                        right: '16px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        maxHeight: '200px',
                        overflow: 'auto',
                        zIndex: 100,
                        marginBottom: '4px',
                    }}>
                        {filteredMentions.slice(0, 10).map((u, index) => (
                            <div
                                key={u.name}
                                onClick={() => insertMention(u.name)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: index === selectedMentionIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
                                }}
                            >
                                <span style={{
                                    fontSize: '10px',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    background: u.type === 'irc' ? '#FF6B6B' : '#5865F2',
                                    color: 'white'
                                }}>
                                    {u.type === 'irc' ? 'IRC' : 'WEB'}
                                </span>
                                <span>@{u.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden'
                }}>
                    {/* Top row: Avatar + Input + Send */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '12px 14px 8px'
                    }}>
                        {/* User Avatar */}
                        <img
                            src={user?.avatar || user?.image || `/api/avatar/${user?.name || 'guest'}`}
                            alt=""
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                flexShrink: 0,
                                marginTop: '4px'
                            }}
                        />

                        {/* Multiline Input */}
                        <textarea
                            ref={inputRef}
                            className="chat-input"
                            placeholder="Message..."
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                resize: 'none',
                                height: '24px',
                                lineHeight: '1.5',
                                padding: '2px 0',
                                overflow: 'hidden'
                            }}
                        />

                    </div>

                    {/* Bottom row: Actions + Send */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 14px 10px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                            style={{
                                background: showGifPicker ? 'rgba(255,255,255,0.15)' : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                color: showGifPicker ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize: '12px'
                            }}
                        >
                            🎬 GIF
                        </button>
                        <button
                            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                            style={{
                                background: showEmojiPicker ? 'rgba(255,255,255,0.15)' : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                color: showEmojiPicker ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize: '12px'
                            }}
                        >
                            😊 Emoji
                        </button>

                        {/* Spacer */}
                        <div style={{ flex: 1 }} />

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            style={{
                                background: inputValue.trim() ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 14px',
                                cursor: inputValue.trim() ? 'pointer' : 'default',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 500,
                                opacity: inputValue.trim() ? 1 : 0.5
                            }}
                        >
                            Send
                        </button>
                    </div>

                    {/* Emoji Picker Popup */}
                    {showEmojiPicker && (
                        <div style={{
                            padding: '10px 14px',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            background: 'var(--bg-tertiary)'
                        }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflow: 'auto' }}>
                                {['😀', '😂', '🥹', '😍', '🥰', '😘', '😎', '🤔', '😤', '😭', '🥺', '😱', '🤯', '🥳', '😈', '💀', '🔥', '❤️', '💜', '💙', '💚', '💛', '🧡', '🖤', '🤍', '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤙', '👋', '💪', '🎉', '🎊', '✨', '⭐', '🌟', '💫', '🚀', '🎮', '🎯', '🏆', '💎', '👀', '💬', '💭', '🗣️'].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => { setInputValue(prev => prev + emoji); setShowEmojiPicker(false); inputRef.current?.focus(); }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            fontSize: '20px',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            borderRadius: '4px'
                                        }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                        onMouseLeave={e => e.target.style.background = 'transparent'}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
