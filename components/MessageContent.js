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
                style={{
                    maxWidth: '200px',
                    maxHeight: '150px',
                    borderRadius: '6px',
                    display: loaded ? 'block' : 'none',
                    cursor: 'pointer',
                }}
                onClick={() => window.open(url, '_blank')}
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
                    maxWidth: '200px',
                    maxHeight: '150px',
                    borderRadius: '6px',
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
                width="200"
                height="112"
                src={`https://www.youtube.com/embed/${videoId}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ borderRadius: '6px', maxWidth: '100%' }}
            />
        </div>
    );
}

// Audio embed component
function AudioEmbed({ url }) {
    return (
        <div className="embed-audio" style={{ marginTop: '8px' }}>
            <audio src={url} controls style={{ maxWidth: '100%' }} />
        </div>
    );
}

// Link preview component (for regular links)
function LinkEmbed({ url }) {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Try to fetch OpenGraph data
        // For now, just show a simple link card
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
            className="embed-link"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                marginTop: '8px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '6px',
                borderLeft: '3px solid #5865F2',
                textDecoration: 'none',
                color: 'inherit',
                maxWidth: '100%',
                boxSizing: 'border-box',
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon icon="fa:link" width="12" /> {hostname}
                </div>
                <div style={{
                    fontSize: '14px',
                    color: '#00AFF4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
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
            <a href={url} target="_blank" rel="noopener noreferrer">
                <div style={{
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    borderLeft: '3px solid #FF6F61',
                    fontSize: '14px',
                    color: '#00AFF4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <Icon icon="fa:film" width="16" /> Tenor GIF - Click to view
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
export default function MessageContent({ text }) {
    // Find all URLs in the message
    const urls = useMemo(() => {
        const matches = text.match(URL_REGEX) || [];
        // Deduplicate
        return [...new Set(matches)];
    }, [text]);

    // Linkify the text (or hide URLs if they become embeds)
    const formattedText = useMemo(() => {
        if (urls.length === 0) return text;

        let result = text;
        urls.forEach(url => {
            // For this app, simply remove the URL from the text if it's being displayed as an embed below
            // This mimics Discord's behavior where the media sits alone if the message is just a URL
            result = result.replace(url, '');
        });

        return result.trim();
    }, [text, urls]);

    return (
        <div className="message-content">
            {/* Text content with linkified URLs */}
            {formattedText && <span dangerouslySetInnerHTML={{ __html: formattedText }} />}

            {/* Render embeds for each URL */}
            {urls.map((url, index) => (
                <EmbedRenderer key={`${url}-${index}`} url={url} />
            ))}
        </div>
    );
}
