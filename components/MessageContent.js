"use client";

import { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';

// URL regex patterns
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|ogg)(\?.*)?$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac)(\?.*)?$/i;

// YouTube regex
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

// Tenor/Giphy GIF detection
const TENOR_REGEX = /tenor\.com\/view\/[^\s]+/i;
const GIPHY_REGEX = /giphy\.com\/(?:gifs|media)\/([^\s\/]+)/i;

// Detect embed type from URL
function getEmbedType(url) {
    if (IMAGE_EXTENSIONS.test(url)) return 'image';
    if (VIDEO_EXTENSIONS.test(url)) return 'video';
    if (AUDIO_EXTENSIONS.test(url)) return 'audio';
    if (YOUTUBE_REGEX.test(url)) return 'youtube';
    if (TENOR_REGEX.test(url)) return 'tenor';
    if (GIPHY_REGEX.test(url)) return 'giphy';
    return 'link';
}

// Extract YouTube video ID
function getYouTubeId(url) {
    const match = url.match(YOUTUBE_REGEX);
    return match ? match[1] : null;
}

// Image embed component
function ImageEmbed({ url, alt }) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    if (error) return null;

    return (
        <div className="embed-image" style={{ marginTop: '8px' }}>
            {!loaded && (
                <div style={{
                    width: '200px',
                    height: '150px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)'
                }}>
                    Loading...
                </div>
            )}
            <img
                src={url}
                alt={alt || 'Embedded image'}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
                className="interactive-media"
                style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    width: 'auto',
                    borderRadius: '8px',
                    display: loaded ? 'block' : 'none',
                    cursor: 'zoom-in',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    transition: 'transform 0.2s ease'
                }}
                onClick={() => window.open(url, '_blank')}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            />
        </div>
    );
}

// Video embed component
function VideoEmbed({ url }) {
    return (
        <div className="embed-video" style={{ marginTop: '8px' }}>
            <video
                src={url}
                controls
                style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    background: 'black'
                }}
            />
        </div>
    );
}

// YouTube embed component
function YouTubeEmbed({ url }) {
    const videoId = getYouTubeId(url);
    if (!videoId) return <LinkEmbed url={url} />;

    return (
        <div className="embed-youtube" style={{ marginTop: '8px' }}>
            <iframe
                width="100%"
                height="auto"
                src={`https://www.youtube.com/embed/${videoId}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                    borderRadius: '8px',
                    maxWidth: '350px',
                    aspectRatio: '16/9',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
            />
        </div>
    );
}

// Audio embed component
function AudioEmbed({ url }) {
    return (
        <div className="embed-audio" style={{ marginTop: '8px' }}>
            <audio src={url} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />
        </div>
    );
}

// Link preview component (for regular links)
function LinkEmbed({ url }) {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, [url]);

    const hostname = useMemo(() => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    }, [url]);

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="embed-link glass-panel"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                marginTop: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textDecoration: 'none',
                color: 'inherit',
                maxWidth: '100%',
                boxSizing: 'border-box',
                transition: 'background 0.2s, transform 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <Icon icon="fa:link" width="14" color="rgba(255,255,255,0.7)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px', fontWeight: '500' }}>
                    {hostname.toUpperCase()}
                </div>
                <div style={{
                    fontSize: '13px',
                    color: '#60A5FA', // Use a nice blue that isn't default link blue
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: '500'
                }}>
                    {url}
                </div>
            </div>
        </a>
    );
}

// Tenor GIF embed
function TenorEmbed({ url }) {
    // Extract the GIF URL from Tenor page
    // For simplicity, just render it as an image since most Tenor links end with .gif
    return (
        <div className="embed-tenor" style={{ marginTop: '8px' }}>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '13px',
                    color: '#F472B6', // Tenor pink-ish
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '500'
                }}>
                    <Icon icon="fa:film" width="14" />
                    <span>Tenor GIF <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>OPEN EXT</span></span>
                </div>
            </a>
        </div>
    );
}

// Main embed renderer
function EmbedRenderer({ url }) {
    const type = getEmbedType(url);

    switch (type) {
        case 'image':
            return <ImageEmbed url={url} />;
        case 'video':
            return <VideoEmbed url={url} />;
        case 'youtube':
            return <YouTubeEmbed url={url} />;
        case 'audio':
            return <AudioEmbed url={url} />;
        case 'tenor':
            return <TenorEmbed url={url} />;
        case 'giphy':
            return <ImageEmbed url={url} />;
        default:
            return <LinkEmbed url={url} />;
    }
}

// Parse message text and render with embeds
export default function MessageContent({ text, onMentionClick, emotes }) {
    // Find all URLs in the message
    const urls = useMemo(() => {
        const matches = text.match(URL_REGEX) || [];
        // Deduplicate
        return [...new Set(matches)];
    }, [text]);

    // Parse text with mentions, URLs, AND emotes
    const formattedContent = useMemo(() => {
        let processedText = text;

        // Remove URLs that will be embedded
        urls.forEach(url => {
            processedText = processedText.replace(url, '');
        });

        processedText = processedText.trim();
        if (!processedText) return null;

        // 1. Split by @mentions - match @word
        const mentionRegex = /@(\w+)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = mentionRegex.exec(processedText)) !== null) {
            // Add text before mention
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: processedText.slice(lastIndex, match.index) });
            }
            // Add mention
            parts.push({ type: 'mention', username: match[1], full: match[0] });
            lastIndex = match.index + match[0].length;
        }
        // Add remaining text
        if (lastIndex < processedText.length) {
            parts.push({ type: 'text', content: processedText.slice(lastIndex) });
        }

        // 2. Process Emotes within 'text' parts
        if (emotes && emotes.size > 0) {
            const emoteParts = [];
            parts.forEach(part => {
                if (part.type === 'text') {
                    // Split by spaces to find emotes
                    const words = part.content.split(/(\s+)/);
                    words.forEach(word => {
                        const trimmed = word.trim();
                        if (emotes.has(trimmed)) {
                            emoteParts.push({ type: 'emote', name: trimmed, url: emotes.get(trimmed) });
                        } else {
                            emoteParts.push({ type: 'text', content: word });
                        }
                    });
                } else {
                    emoteParts.push(part);
                }
            });
            return emoteParts;
        }

        return parts.length > 0 ? parts : [{ type: 'text', content: processedText }];
    }, [text, urls, emotes]);

    return (
        <div className="message-content" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: '1.5' }}>
            {/* Text content with mentions and emotes */}
            {formattedContent && formattedContent.map((part, i) => {
                if (part.type === 'mention') {
                    return (
                        <span
                            key={i}
                            onClick={(e) => onMentionClick && onMentionClick(part.username, e)}
                            style={{
                                color: '#7289da',
                                background: 'rgba(114, 137, 218, 0.15)',
                                padding: '0 2px',
                                borderRadius: '3px',
                                cursor: onMentionClick ? 'pointer' : 'default',
                                fontWeight: 500
                            }}
                        >
                            @{part.username}
                        </span>
                    );
                }
                if (part.type === 'emote') {
                    return (
                        <img
                            key={i}
                            src={part.url}
                            alt={part.name}
                            title={part.name}
                            className="chat-emote"
                            style={{
                                verticalAlign: 'middle',
                                height: '32px',
                                margin: '0 2px',
                                display: 'inline-block'
                            }}
                        />
                    );
                }
                return <span key={i}>{part.content}</span>;
            })}

            {/* Render embeds for each URL */}
            {urls.map((url, index) => (
                <EmbedRenderer key={`${url}-${index}`} url={url} />
            ))}
        </div>
    );
}

