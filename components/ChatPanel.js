"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@/hooks/useChat';
import { useEmotes } from '@/hooks/useEmotes';
import { useSocket } from '@/lib/socket';
import MessageContent from './MessageContent';
import SystemMessage from './SystemMessage';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import { Icon } from '@iconify/react';
import MessageReactions from './MessageReactions';

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

export default function ChatPanel({
    roomId,
    user,
    currentUser, // Pass current user for self-lookup
    users = [],
    ircUsers = [],
    onUserClick = () => { },
    sendToIRC = () => { },
    // Chat props passed from parent
    messages,
    sendMessage,
    isLoading,
    typingUsers,
    handleTyping,
    isTyping,
    // Mobile navigation props
    isMobile = false,
    activeTab = 'logs',
    setActiveTab = () => { },
    peers = new Map()
}) {
    const { socket } = useSocket();
    const { emotes } = useEmotes(); // Load 7TV emotes
    const [inputValue, setInputValue] = useState('');
    const [showPicker, setShowPicker] = useState(false); // Unified Picker State
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    // Message reactions state: messageId -> { emoji -> { count, users } }
    const [messageReactions, setMessageReactions] = useState({});

    // Moderation state
    // Moderation state
    const [wipedMessageIds, setWipedMessageIds] = useState(new Set());
    const [shadowMutedUsers, setShadowMutedUsers] = useState(new Set());

    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifQuery, setGifQuery] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const panelRef = useRef(null);

    // Listen for reaction updates from server
    useEffect(() => {
        if (!socket) return;

        const handleReactionsUpdate = ({ messageId, reactions }) => {
            setMessageReactions(prev => ({
                ...prev,
                [messageId]: reactions
            }));
        };

        socket.on('message-reactions-update', handleReactionsUpdate);
        return () => socket.off('message-reactions-update', handleReactionsUpdate);
    }, [socket]);

    // Listen for moderation events
    useEffect(() => {
        if (!socket) return;

        // Message wipe event
        const handleMessagesWiped = ({ targetUserId, messageIds }) => {
            setWipedMessageIds(prev => {
                const newSet = new Set(prev);
                messageIds.forEach(id => newSet.add(id));
                return newSet;
            });
        };

        // Mute status update (for mods)
        const handleMuteStatus = ({ targetUserId, isMuted }) => {
            setShadowMutedUsers(prev => {
                const newSet = new Set(prev);
                if (isMuted) {
                    newSet.add(targetUserId);
                } else {
                    newSet.delete(targetUserId);
                }
                return newSet;
            });
        };

        socket.on('mod-messages-wiped', handleMessagesWiped);
        socket.on('mod-mute-status', handleMuteStatus);

        return () => {
            socket.off('mod-messages-wiped', handleMessagesWiped);
            socket.off('mod-mute-status', handleMuteStatus);
        };
    }, [socket]);
    // Initialize reactions from history messages
    useEffect(() => {
        if (!messages) return;
        const initialReactions = {};
        let hasNewReactions = false;

        messages.forEach(msg => {
            if (msg.reactions && Object.keys(msg.reactions).length > 0) {
                initialReactions[msg.id] = msg.reactions;
                hasNewReactions = true;
            }
        });

        if (hasNewReactions) {
            setMessageReactions(prev => ({
                ...prev,
                ...initialReactions
            }));
        }
    }, [messages]);

    // Reaction handlers
    const handleReact = useCallback((messageId, emoji) => {
        if (socket) {
            socket.emit('message-react', { messageId, emoji });
        }
    }, [socket]);

    const handleUnreact = useCallback((messageId, emoji) => {
        if (socket) {
            socket.emit('message-unreact', { messageId, emoji });
        }
    }, [socket]);

    const isMod = useMemo(() => {
        const role = user?.role?.toUpperCase();
        return ['ADMIN', 'MODERATOR', 'OWNER'].includes(role);
    }, [user?.role]);

    // Group messages for Discord-style display (filter wiped for non-mods)
    const messageGroups = useMemo(() => {
        const filteredMessages = isMod
            ? messages
            : messages.filter(m => !wipedMessageIds.has(m.id));
        return groupMessages(filteredMessages);
    }, [messages, isMod, wipedMessageIds]);

    // Combine web users and IRC users for mentions
    const allUsers = [
        ...users.map(u => ({ name: u.name || u.user?.name, type: 'web' })),
        ...ircUsers.map(u => ({ name: u.nick || u.name, type: 'irc' }))
    ].filter(u => u.name && u.name !== user?.name);

    // Filter users based on mention query
    const filteredMentions = mentionQuery
        ? allUsers.filter(u => u.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
        : allUsers;

    // Auto-scroll to bottom with slight delay to account for layout/animation changes
    useEffect(() => {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
        return () => clearTimeout(timer);
    }, [messages, typingUsers]);

    // Reset mention selection when filtered list changes
    useEffect(() => {
        setSelectedMentionIndex(0);
    }, [filteredMentions.length]);
    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'; // Reset to re-calculate shrink
            inputRef.current.style.height = (inputRef.current.scrollHeight) + 'px';
        }
    }, [inputValue]);

    const handleSend = () => {
        if (inputValue.trim()) {
            sendMessage(inputValue);
            sendToIRC(inputValue); // Send to IRC via client
            setInputValue('');
            setShowMentions(false);
            setInputValue('');
            setShowMentions(false);
            setShowPicker(false);
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
        sendToIRC(gifUrl); // Send to IRC via client
        setShowGifPicker(false);
        setGifQuery('');
        setInputValue('');

        // Reset lock after short delay
        setTimeout(() => {
        }, 500);
    };

    // Callback when an item is selected from Picker
    const handlePickerSelect = (item) => {
        // If it starts with http, it might be a gif from a future gif tab, but for now we assume Emote name
        // Check if it's a known emote to prevent confusion
        const code = emotes.has(item) ? item : item;

        // Insert into input
        setInputValue(prev => prev + (prev.endsWith(' ') ? '' : ' ') + code + ' ');
        inputRef.current?.focus();
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
            // Future: Show picker
            setGifQuery('');
            setShowMentions(false);
        }

        // Emoji replacement map
        const emojiMap = {
            ':D': '😃',
            ':)': '🙂',
            ':(': '🙁',
            ';)': '😉',
            ':P': '😛',
            ':p': '😛',
            '<3': '❤️',
            ':o': '😮',
            ':O': '😮',
            ':joy': '😂',
            ':sob': '😭',
            ':fire': '🔥'
        };

        let newValue = value;
        Object.entries(emojiMap).forEach(([code, emoji]) => {
            // Replace code if it's followed by a space
            newValue = newValue.replace(new RegExp(`(^|\\s)${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'g'), `$1${emoji}$2`);
        });

        if (newValue !== value) {
            setInputValue(newValue);
        }

        // Handle Mentions
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = newValue.slice(0, cursorPos);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            const query = textBeforeCursor.slice(lastAt + 1);
            // Check if there's a space after @
            if (!query.includes(' ')) {
                setMentionQuery(query);
                setShowMentions(true);
                return;
            }
        }
        setShowMentions(false);

        if (!value.startsWith('/gif')) {
            // Check for :word pattern logic
            const colonMatch = value.match(/:(\w+)$/);
            if (colonMatch && colonMatch[1].length >= 3) {
                const colonMatch = value.match(/:(\w+)$/);
                if (colonMatch && colonMatch[1].length >= 3) {
                    // Logic to maybe auto-show specific emote hints could go here
                    // For now, we rely on the main picker button
                } else {

                }
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if (showMentions && filteredMentions.length > 0) {
                e.preventDefault();
                insertMention(filteredMentions[selectedMentionIndex].name);
                return;
            }
            e.preventDefault();
            handleSend();
            return;
        }

        if (showMentions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev + 1) % Math.min(filteredMentions.length, 10));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev - 1 + Math.min(filteredMentions.length, 10)) % Math.min(filteredMentions.length, 10));
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
        }
    };

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Scroll to bottom whenever messages change
    // Using a separate effect for 'messages' specifically to ensure it triggers after render
    // Already handled in the combined effect above.

    return (
        <div ref={panelRef} className="chat-panel backdrop-blur backdrop-saturate-200 backdrop-brightness-[1.1] backdrop-contrast-150 border-l border-white/20" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
        }}>
            {/* Messages Area - Flex Grow */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                paddingBottom: isMobile ? '80px' : '16px', // Extra padding on mobile for fixed input
                display: 'flex',
                flexDirection: 'column',
                scrollBehavior: 'smooth',
                minHeight: 0
            }}>
                {/* Intro / Spacer at top */}
                <div style={{ marginTop: 'auto' }}></div>

                {/* DEBUG OVERLAY */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    fontSize: '10px',
                    background: 'rgba(0,0,0,0.8)',
                    color: 'lime',
                    padding: '4px',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    border: '2px solid yellow',
                    display: 'none' // Hidden for polish
                }}>
                    <div style={{ fontWeight: 'bold' }}>DEBUG v2.0</div>
                    <div>Count: {messages.length}</div>
                    <div>Groups: {messageGroups.length}</div>
                    <div>Sys: {messages.filter(m => m.sender === 'System').length}</div>
                </div>

                {/* Calculate last group indices for typing animation */}
                {(() => {
                    const lastGroupIndices = {};
                    messageGroups.forEach((g, i) => lastGroupIndices[g.sender] = i);

                    return messageGroups.map((group, groupIndex) => {
                        // Check if this is a System group
                        if (group.sender === 'System') {
                            return (
                                <motion.div
                                    key={group.messages[0]?.id || `group-${groupIndex}`}
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    {group.messages.map(msg => (
                                        <SystemMessage key={msg.id || Date.now()} message={msg} onUserClick={onUserClick} />
                                    ))}
                                </motion.div>
                            );
                        }

                        const isTypingUser = typingUsers.includes(group.sender);
                        const isMostRecentCallback = lastGroupIndices[group.sender] === groupIndex;
                        const shouldAnimate = isTypingUser && isMostRecentCallback;

                        return (
                            <motion.div
                                key={group.messages[0]?.id || `group-${groupIndex}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                                className="message-group"
                                style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginBottom: '4px', // Reduced group margin
                                    padding: '0',
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
                                        src={(() => {
                                            // Prioritize: 1. Self 2. active Peer 3. IRC User 4. Message Avatar
                                            const isSelf = currentUser && currentUser.name === group.sender;
                                            const liveUser = users.find(u => u.name === group.sender);
                                            const ircUser = ircUsers.find(u => u.name === group.sender);

                                            // IRC users often don't have avatars, but check anyway
                                            const effectiveAvatar = (isSelf ? currentUser.avatar : null) ||
                                                liveUser?.avatar ||
                                                ircUser?.avatar ||
                                                group.senderAvatar ||
                                                `/api/avatar/${group.sender}`;
                                            const base = effectiveAvatar;
                                            // Only animate if it's our internal avatar API
                                            if (shouldAnimate && base && base.includes('/api/avatar')) {
                                                const hasQuery = base.includes('?');
                                                return `${base}${hasQuery ? '&' : '?'}expr=typing`;
                                            }
                                            return base || `/api/avatar/${group.sender}`;
                                        })()}
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
                                        <span
                                            style={{
                                                fontWeight: '600',
                                                color: group.senderColor || 'var(--text-primary)',
                                                fontSize: '15px',
                                                cursor: isMod ? 'context-menu' : 'default'
                                            }}
                                            // Remove onContextMenu
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUserClick && onUserClick(group.sender, group.senderId, group.senderAvatar);
                                            }}
                                        >
                                            {group.sender}
                                            {/* Shadow mute indicator for mods */}
                                            {isMod && shadowMutedUsers.has(group.senderId) && (
                                                <span style={{
                                                    marginLeft: '6px',
                                                    fontSize: '10px',
                                                    background: '#dc2626',
                                                    color: 'white',
                                                    padding: '1px 4px',
                                                    borderRadius: '3px',
                                                    verticalAlign: 'middle'
                                                }}>MUTED</span>
                                            )}
                                        </span>
                                        <span style={{
                                            fontSize: '11px',
                                            color: 'var(--text-muted)',
                                            opacity: 0.6,
                                            fontWeight: '400',
                                            marginLeft: '4px'
                                        }}>
                                            {formatTime(group.timestamp)}
                                        </span>
                                    </div>

                                    {/* Messages */}
                                    {group.messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className="message-row-container"
                                        >
                                            {msg.type === 'system' ? (
                                                <div className="message-row" style={{ marginBottom: '2px', paddingLeft: '0' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <SystemMessage
                                                            text={msg.text}
                                                            type={msg.systemType}
                                                            timestamp={msg.timestamp}
                                                            metadata={msg.metadata}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="message-row"
                                                    style={{
                                                        marginBottom: '0px',
                                                        lineHeight: '1.3',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        position: 'relative',
                                                        paddingLeft: '0',
                                                    }}
                                                >
                                                    {/* Hover Timestamp (Absolute) */}
                                                    <span className="line-timestamp" style={{
                                                        position: 'absolute',
                                                        left: '-36px',
                                                        top: '2px',
                                                        fontSize: '9px',
                                                        color: 'var(--text-muted)',
                                                        opacity: 0,
                                                        width: '30px',
                                                        textAlign: 'right',
                                                        userSelect: 'none',
                                                        pointerEvents: 'none', // Don't block clicks
                                                        transition: 'opacity 0.1s'
                                                    }}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    </span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <MessageContent
                                                            text={msg.text}
                                                            onMentionClick={(username, e) => onUserClick({ name: username }, e)}
                                                            emotes={emotes}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <MessageReactions
                                                messageId={msg.id}
                                                reactions={messageReactions[msg.id] || {}}
                                                onReact={handleReact}
                                                onUnreact={handleUnreact}
                                                currentUserId={user?.id}
                                                center={msg.type === 'system'}
                                                emotes={emotes}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    });
                })()}

                {typingUsers.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                            fontSize: '13px',
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                            padding: '8px 0',
                        }}
                    >
                        {typingUsers.join(', ')} is typing...
                    </motion.div>
                )}

                <div ref={messagesEndRef} style={{ height: '20px', flexShrink: 0 }} />
            </div>

            <style jsx>{`
                .message-row:hover .line-timestamp {
                    opacity: 0.4 !important;
                }
                .message-group:hover .line-timestamp {
                    opacity: 0.2;
                }
                /* Show reaction button on hover */
                .message-row-container:hover :global(.reaction-add-btn) {
                    opacity: 1 !important;
                }
            `}</style>

            {/* Input Area - Fixed to bottom on mobile */}
            <div className="input-area" style={{
                position: isMobile ? 'fixed' : 'relative',
                bottom: isMobile ? 0 : undefined,
                left: isMobile ? 0 : undefined,
                right: isMobile ? 0 : undefined,
                padding: isMobile ? '8px 8px 12px' : '0 4px 8px',
                flexShrink: 0,
                background: 'var(--glass-bg-heavy)',
                backdropFilter: 'var(--glass-blur-heavy)',
                zIndex: isMobile ? 100 : undefined
            }}>
                {/* GIF Picker with search */}
                {showGifPicker && (
                    <div style={{
                        background: 'var(--glass-bg)',
                        backdropFilter: 'var(--glass-blur)',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
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
                                    background: 'var(--glass-bg-hover)',
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
                        background: 'var(--glass-bg-heavy)',
                        backdropFilter: 'var(--glass-blur-heavy)',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
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
                    overflow: 'visible',
                    position: 'relative',
                    zIndex: 1,
                    padding: isMobile ? '4px' : '0'
                }}>
                    {/* Input Row: Textarea + Buttons (Icons on Mobile) */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '6px' : '10px',
                        padding: isMobile ? '4px 8px' : '8px 12px 6px',
                        background: isMobile ? 'rgba(255,255,255,0.03)' : 'transparent',
                        borderRadius: isMobile ? '16px' : '0',
                        border: isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none'
                    }}>
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
                                display: 'block',
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: isMobile ? '14px' : '15px',
                                resize: 'none',
                                maxHeight: '200px',
                                height: 'auto',
                                minHeight: '24px',
                                lineHeight: '1.5',
                                padding: '4px 0',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word'
                            }}
                        />

                        {/* Action Buttons Group */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px' }}>
                            <button
                                onClick={() => { setShowGifPicker(!showGifPicker); setShowPicker(false); }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    color: showGifPicker ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <Icon icon="mdi:gif" width={isMobile ? "24" : "20"} />
                            </button>
                            <button
                                onClick={() => { setShowPicker(!showPicker); }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    color: showPicker ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <Icon icon={showPicker ? "mdi:emoticon-happy" : "mdi:emoticon-happy-outline"} width={isMobile ? "22" : "20"} />
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px',
                                    cursor: inputValue.trim() ? 'pointer' : 'default',
                                    color: inputValue.trim() ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    opacity: inputValue.trim() ? 1 : 0.4,
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <Icon icon="mdi:send" width={isMobile ? "24" : "20"} />
                            </button>
                        </div>
                    </div>

                    {/* Emoji Picker Popup (Desktop or Mobile fallback) */}
                    {/* Emoji Picker Popup */}
                    <AnimatePresence>
                        {showPicker && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.1 }}
                                style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    right: '0',
                                    marginBottom: '12px',
                                    zIndex: 100
                                }}
                            >
                                <EmojiPicker
                                    onSelect={handlePickerSelect}
                                    emotes={emotes}
                                    onClose={() => setShowPicker(false)}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}



