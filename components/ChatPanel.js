"use client";

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';

export default function ChatPanel({ roomId, user }) {
    const { messages, sendMessage, handleTyping, typingUsers } = useChat(roomId, user);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (inputValue.trim()) {
            sendMessage(inputValue);
            setInputValue('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
        handleTyping();

        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    return (
        <section className="panel chat" aria-label="Chat panel">

            <div className="msgs">
                {messages.length === 0 && (
                    <div className="msg">
                        <div className="avatar"></div>
                        <div className="bubble">
                            <div className="meta">
                                <div className="nick">System</div>
                                <div className="time">{formatTime(new Date())}</div>
                            </div>
                            <div className="text">
                                <span className="me">Welcome</span> to the chat room. Start a conversation!
                            </div>
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className="msg">
                        <div
                            className="avatar"
                            style={{
                                background: `linear-gradient(135deg, ${msg.senderColor}88, ${msg.senderColor}55)`
                            }}
                        ></div>
                        <div className="bubble">
                            <div className="meta">
                                <div className="nick" style={{ color: msg.senderColor }}>
                                    {msg.sender}
                                </div>
                                <div className="time">{formatTime(msg.timestamp)}</div>
                            </div>
                            <div className="text">{msg.text}</div>
                        </div>
                    </div>
                ))}

                {typingUsers.length > 0 && (
                    <div className="typing-indicator" style={{
                        fontSize: '12px',
                        color: 'var(--muted)',
                        padding: '8px 12px',
                        fontStyle: 'italic'
                    }}>
                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="composer">
                <button className="smallbtn" type="button" title="Emoji">😊</button>
                <div className="input">
                    <textarea
                        ref={textareaRef}
                        rows="1"
                        placeholder="Message the room…"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <button
                    className="smallbtn send"
                    type="button"
                    title="Send"
                    onClick={handleSend}
                >
                    ➤
                </button>
            </div>
        </section>
    );
}
