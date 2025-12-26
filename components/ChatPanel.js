"use client";

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import MessageContent from './MessageContent';

export default function ChatPanel({ roomId, user, users = [], ircUsers = [] }) {
    const { messages, sendMessage, handleTyping, typingUsers } = useChat(roomId, user);
    const [inputValue, setInputValue] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

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
        }
    };

    const insertMention = (username) => {
        // Find the @ position and replace with mention
        const cursorPos = inputRef.current?.selectionStart || inputValue.length;
        const textBeforeCursor = inputValue.slice(0, cursorPos);
        const textAfterCursor = inputValue.slice(cursorPos);

        // Find the last @ before cursor
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const newValue = textBeforeCursor.slice(0, lastAtIndex) + `@${username} ` + textAfterCursor;
            setInputValue(newValue);
        }

        setShowMentions(false);
        setMentionQuery('');
        inputRef.current?.focus();
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        handleTyping();

        // Check for @ mentions
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
            // Show mentions if @ is at start or preceded by space, and no space after @
            if ((lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === ' ') && !textAfterAt.includes(' ')) {
                setShowMentions(true);
                setMentionQuery(textAfterAt);
            } else {
                setShowMentions(false);
            }
        } else {
            setShowMentions(false);
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
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="msgs">
                {messages.length === 0 && (
                    <div className="msg" style={{ justifyContent: 'center', opacity: 0.5, fontStyle: 'italic' }}>
                        <div className="content">
                            No messages yet. Start the conversation!
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className="msg">
                        <div className="author" style={{ color: msg.senderColor }}>
                            {msg.sender}
                        </div>
                        <div className="content">
                            <MessageContent text={msg.text} />
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                marginLeft: '8px',
                                opacity: 0.6
                            }}>
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                ))}

                {typingUsers.length > 0 && (
                    <div className="msg">
                        <div className="content" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            {typingUsers.join(', ')} is typing...
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area with Mention Autocomplete */}
            <div className="input-area" style={{ position: 'relative' }}>
                {/* Mention Dropdown */}
                {showMentions && filteredMentions.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px 8px 0 0',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderBottom: 'none',
                        maxHeight: '200px',
                        overflow: 'auto',
                        zIndex: 100,
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

                <input
                    ref={inputRef}
                    className="chat-input"
                    placeholder="Type a message... (@ to mention)"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                />
            </div>
        </div>
    );
}
