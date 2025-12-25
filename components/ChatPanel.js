"use client";

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';

export default function ChatPanel({ roomId, user }) {
    const { messages, sendMessage, handleTyping, typingUsers } = useChat(roomId, user);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingUsers]);

    const handleSend = () => {
        if (inputValue.trim()) {
            sendMessage(inputValue);
            setInputValue('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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
                        {msg.text}
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

            {/* Input Area */}
            <div className="input-area">
                <input
                    className="chat-input"
                    placeholder="Type a message..."
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        handleTyping();
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
        </div>
    );
}
