import { Icon } from '@iconify/react';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import Convert from 'ansi-to-html';

const convert = new Convert({
    fg: '#c9d1d9',
    bg: '#0d1117',
    newline: false,
    escapeXML: true,
    colors: {
        0: '#000000', 1: '#ff5555', 2: '#50fa7b', 3: '#f1fa8c',
        4: '#bd93f9', 5: '#ff79c6', 6: '#8be9fd', 7: '#f8f8f2',
        8: '#6272a4', 9: '#ff6e6e', 10: '#69ff94', 11: '#ffffa5',
        12: '#d6acff', 13: '#ff92df', 14: '#a4ffff', 15: '#ffffff'
    }
});

function formatTime(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SystemMessage({ message, onUserClick = () => { } }) {
    const { systemType, text, metadata, timestamp } = message;

    // Elapsed timer for active deployments
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (systemType !== 'deploy-start') return;

        // Calculate initial elapsed time
        const startTime = new Date(timestamp).getTime();
        const updateElapsed = () => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        };

        updateElapsed(); // Initial
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [systemType, timestamp]);

    // Format elapsed time as MM:SS
    const formatElapsed = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Minimal style for join/leave events with optional Avatars
    if (systemType === 'join-leave') {
        const users = metadata?.users || [];

        return (
            <div style={{
                padding: '6px 12px',
                fontSize: '12px',
                color: '#9ca3af', // Gray-400 (Lighter)
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'center',
                opacity: 1,
                background: 'var(--glass-bg)', // Glass bg
                borderRadius: '8px',
                margin: '4px 0',
                border: '1px solid var(--glass-border)'
            }}>
                {/* Avatar Stripe */}
                {users.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {users.map((u, i) => (
                            <motion.div
                                key={u.name || i} // Name is unique per bundle usually
                                layout // Allow sliding when new items added
                                initial={{ scale: 0, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                className="relative group"
                                title={u.name}
                                style={{ position: 'relative', cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUserClick({ name: u.name, avatar: u.avatar || u.image, color: u.color }, e);
                                }}
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <img
                                    src={u.avatar || u.image || `/api/avatar/${u.name || 'guest'}`}
                                    alt={u.name}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        border: u.action && u.action.includes('left') ? '1px solid #666' : '1px solid #10b981',
                                        opacity: u.action && u.action.includes('left') ? 0.5 : 1,
                                        filter: u.action && u.action.includes('left') ? 'grayscale(100%)' : 'none',
                                        objectFit: 'cover',
                                        background: '#333'
                                    }}
                                    onError={(e) => {
                                        // Fallback to initial if image fails
                                        const initials = u.name?.charAt(0).toUpperCase() || '?';
                                        const parent = e.target.parentNode;
                                        e.target.style.display = 'none';
                                        parent.style.backgroundColor = '#4f46e5'; // Indigo-600
                                        parent.style.display = 'flex';
                                        parent.style.alignItems = 'center';
                                        parent.style.justifyContent = 'center';
                                        parent.innerText = initials;
                                        parent.style.fontSize = '11px';
                                        parent.style.color = 'white';
                                        parent.style.fontWeight = '800';
                                        parent.style.width = '24px';
                                        parent.style.height = '24px';
                                        parent.style.borderRadius = '50%';
                                        parent.style.border = '1px solid rgba(255,255,255,0.2)';
                                    }}
                                />
                                {/* Status Indicator Dot */}
                                {u.action === 'cam-up' && (
                                    <div style={{
                                        position: 'absolute', bottom: -2, right: -2,
                                        width: '8px', height: '8px',
                                        background: '#f43f5e', borderRadius: '50%', border: '1px solid #000'
                                    }} />
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
                    <Icon icon="mdi:account-group-outline" width="14" />
                    <span>{text}</span>
                    <span style={{ opacity: 0.4, fontSize: '10px', marginLeft: '4px' }}>{formatTime(timestamp)}</span>
                </div>
            </div>
        );
    }

    // Configuration for different message types
    const config = {
        'deploy-start': {
            icon: 'mdi:cog',
            color: '#f59e0b', // Amber/Orange
            bgColor: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            kicker: 'MISSION CONTROL',
            animation: 'building-progress',
            showProgress: true
        },
        'deploy-success': {
            icon: 'mdi:check-circle',
            color: '#10b981', // Emerald/Green
            bgColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            kicker: 'DEPLOYMENT SUCCESSFUL',
            animation: 'none'
        },
        'deploy-fail': {
            icon: 'mdi:alert-octagon',
            color: '#ef4444', // Red
            bgColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.4)',
            kicker: 'DEPLOYMENT FAILED',
            animation: 'none'
        },
        'git-push': {
            icon: 'mdi:git',
            color: '#8b5cf6', // Violet
            bgColor: 'rgba(139, 92, 246, 0.1)',
            borderColor: 'rgba(139, 92, 246, 0.3)',
            kicker: 'CODE UPDATE',
            animation: 'none'
        },
        'tube-video': {
            icon: 'mdi:youtube',
            color: '#ff0000', // YouTube Red
            bgColor: 'rgba(255, 0, 0, 0.08)',
            borderColor: 'rgba(255, 0, 0, 0.3)',
            kicker: 'TUBE',
            animation: 'none'
        },
        'tube-now-playing': {
            icon: 'mdi:play-circle',
            color: '#22c55e', // Green
            bgColor: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.4)',
            kicker: '▶ ON AIR',
            animation: 'pulse'
        },
        'tube-stopped': {
            icon: 'mdi:stop-circle',
            color: '#6b7280', // Gray
            bgColor: 'rgba(107, 114, 128, 0.1)',
            borderColor: 'rgba(107, 114, 128, 0.3)',
            kicker: '◼ OFF AIR',
            animation: 'none'
        },
        'tube-resumed': {
            icon: 'mdi:play',
            color: '#22c55e', // Green
            bgColor: 'rgba(34, 197, 94, 0.08)',
            borderColor: 'rgba(34, 197, 94, 0.3)',
            kicker: '▶ PLAYING',
            animation: 'none'
        },
        'tube-paused': {
            icon: 'mdi:pause',
            color: '#f59e0b', // Amber
            bgColor: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            kicker: '⏸ PAUSED',
            animation: 'none'
        },
        'tube-queue': {
            icon: 'mdi:youtube',
            color: '#f97316', // Orange
            bgColor: 'rgba(249, 115, 22, 0.1)',
            borderColor: 'rgba(249, 115, 22, 0.4)',
            kicker: '⏭ UP NEXT',
            animation: 'none'
        },
        'info': {
            icon: 'mdi:information-variant',
            color: '#3b82f6', // Blue
            bgColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgba(59, 130, 246, 0.3)',
            kicker: 'SYSTEM INFO',
            animation: 'none'
        },
        'deploy-log': {
            icon: 'mdi:console-line',
            color: '#6b7280', // Gray
            bgColor: 'rgba(107, 114, 128, 0.05)',
            borderColor: 'rgba(107, 114, 128, 0.2)',
            kicker: null, // No kicker for log lines
            animation: 'none',
            compact: true // Special flag for minimal styling
        }
    };

    const style = config[systemType] || config['info'];

    // Compact rendering for build log lines
    if (style.compact) {
        return (
            <div style={{
                margin: '2px 0',
                padding: '2px 8px',
                background: style.bgColor,
                // borderLeft: `2px solid ${style.borderColor}`, // Replaced with div below
                position: 'relative',
                fontSize: '11px',
                fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", monospace',
                color: '#9ca3af',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                opacity: 0.85,
                paddingLeft: '12px' // Make room for bar
            }}>
                <div
                    className={style.color === '#22c55e' ? 'throb-drip-green' : ''}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '3px',
                        background: style.color // Use solid color for the bar
                    }}
                />
                {children || text}
            </div>
        );
    }

    return (
        <div className={`system-message-card ${style.animation}`} style={{
            margin: '8px auto', // Center horizontally
            padding: '0',
            background: 'var(--glass-bg-heavy)',
            backdropFilter: 'var(--glass-blur)',
            border: `1px solid ${style.borderColor}`,
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            fontFamily: 'monospace, monospace', // Tech look
            boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.3)`,
            maxWidth: '480px', // Limit width for better appearance
            width: '100%'
        }}>
            {/* Kicker / Header Bar */}
            <div style={{
                background: style.bgColor,
                padding: '4px 8px',
                borderBottom: `1px solid ${style.borderColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: style.color,
                fontSize: '10px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                textTransform: 'uppercase'
            }}>
                <Icon icon={style.icon} width="14" className={systemType === 'deploy-start' ? 'spin' : ''} />
                <span>{metadata?.phase || style.kicker}</span>
                {systemType === 'deploy-start' && (
                    <span style={{
                        background: 'rgba(245, 158, 11, 0.3)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        marginLeft: '4px'
                    }}>
                        ⏱ {formatElapsed(elapsed)}
                    </span>
                )}
                <span style={{ marginLeft: 'auto', opacity: 0.5, fontWeight: 'normal' }}>
                    {formatTime(timestamp)}
                </span>
            </div>

            {/* Content Body */}
            <div style={{
                padding: '8px',
                color: '#e5e5e5',
                fontSize: '13px',
                lineHeight: '1.5'
            }}>
                <ReactMarkdown
                    components={{
                        p: ({ node, ...props }) => <div {...props} />, // Render paragraphs as divs
                        a: ({ node, ...props }) => <a {...props} style={{ color: style.color, textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" />
                    }}
                >
                    {text}
                </ReactMarkdown>

                {/* Build Logs Terminal (Cinematic) */}
                {metadata && metadata.logs && metadata.logs.length > 0 && (
                    <CinematicScanline
                        logs={metadata.logs}
                        timestamp={message.timestamp}
                        type={message.systemType}
                    />
                )}

                {/* Extended Metadata (Commit info, etc.) */}
                {metadata && !metadata.logs && !metadata.thumbnail && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '11px', color: '#888' }}>
                        {metadata.commit && <div>Commit: <span style={{ color: '#ccc' }}>{metadata.commit}</span></div>}
                        {metadata.author && <div>Author: <span style={{ color: '#ccc' }}>{metadata.author}</span></div>}
                        {metadata.duration && <div>Duration: <span style={{ color: '#ccc' }}>{metadata.duration}</span></div>}
                    </div>
                )}

                {/* YouTube Thumbnail for Now Playing */}
                {metadata?.thumbnail && (
                    <div style={{
                        marginTop: '8px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        position: 'relative',
                        aspectRatio: '16/9',
                        maxWidth: '280px',
                        background: '#111'
                    }}>
                        <img
                            src={metadata.thumbnail}
                            alt={metadata.title || 'Video thumbnail'}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: 0.9
                            }}
                        />
                        {metadata.startedBy && (
                            <div style={{
                                position: 'absolute',
                                bottom: '4px',
                                right: '4px',
                                background: 'rgba(0,0,0,0.75)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                color: '#aaa'
                            }}>
                                by {metadata.startedBy}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Progress Bar for Deploying */}
            {style.showProgress && (
                <div className="progress-bar-container">
                    <div className="progress-bar-fill"></div>
                </div>
            )}

            {/* CSS Variables for Animation */}
            <style jsx>{`
            .system-message-card {
                 transition: border-color 0.5s ease, box-shadow 0.5s ease;
            }
            .pulse-border {
                box-shadow: 0 0 0 0 ${style.borderColor};
                animation: pulse-border-anim 2s infinite;
            }
            @keyframes pulse-border-anim {
                0% { box-shadow: 0 0 0 0 ${style.borderColor}; }
                70% { box-shadow: 0 0 0 4px rgba(0, 0, 0, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
            }
            .success-glow {
                box-shadow: 0 0 15px ${style.color};
                animation: success-glow-anim 1.5s ease-out infinite alternate;
            }
            @keyframes success-glow-anim {
                 from { box-shadow: 0 0 10px ${style.color}; }
                 to { box-shadow: 0 0 20px ${style.color}; }
            }
            
            :global(.spin) {
                animation: spin 1s linear infinite;
                display: inline-block; /* Ensure rotation works */
            }
            @keyframes spin { 100% { transform: rotate(360deg); } }

            @keyframes slideIn {
                from { opacity: 0; transform: translateX(-5px); }
            }

            /* Progress Bar Animation - Fuzzy, Throbbing, Dripping */
            .progress-bar-container {
                height: 6px;
                width: 100%;
                background: rgba(0,0,0,0.5);
                overflow: visible; /* Allow dripping/glow outside */
                position: relative;
                border-radius: 4px;
            }
            .progress-bar-fill {
                height: 100%;
                width: 40%;
                background: ${style.color};
                border-radius: 4px;
                position: relative;
                filter: url(#goo); /* Attempt gooey effect if SVG filter exists, else fallback to shadow */
                
                /* Fuzzy Glow */
                box-shadow: 
                    0 0 10px ${style.color},
                    0 0 20px ${style.color},
                    0 0 40px ${style.color};
                
                /* Throbbing Animation */
                animation: throb-sweep 2s ease-in-out infinite;
            }

            /* Dripping Particles */
            .progress-bar-fill::after {
                content: '';
                position: absolute;
                top: 50%;
                right: 0;
                width: 10px;
                height: 10px;
                background: ${style.color};
                border-radius: 50%;
                box-shadow: 0 0 10px ${style.color};
                animation: drip-drop 1.5s ease-in infinite;
            }

            @keyframes throb-sweep {
                0% { 
                    transform: translateX(-100%) scaleY(1); 
                    opacity: 0.8;
                    filter: blur(2px) contrast(1.2);
                }
                50% { 
                    transform: translateX(0%) scaleY(1.5); 
                    opacity: 1;
                    filter: blur(0px) contrast(1);
                }
                100% { 
                    transform: translateX(400%) scaleY(1); 
                    opacity: 0.8;
                    filter: blur(2px) contrast(1.2);
                }
            }

            @keyframes drip-drop {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                80% { transform: translateY(20px) scale(0.5); opacity: 0.8; }
                100% { transform: translateY(40px) scale(0); opacity: 0; }
            }

            /* Revert other animations to simple ones */
            .building-progress .cog-icon {
                animation: slow-spin 4s linear infinite;
            }
            @keyframes slow-spin {
                100% { transform: rotate(360deg); }
            }

            /* Terminal Polish */
            .terminal-window::-webkit-scrollbar {
                width: 6px;
                background: rgba(0,0,0,0.1);
            }
            .terminal-window::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
            }
            .terminal-window::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.2);
            }
            .job-header {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
                letter-spacing: -0.5px;
            }
            :global(.log-line) {
                transition: opacity 0.2s, background 0.1s;
                border-radius: 2px;
            }
            :global(.log-line:hover) {
                opacity: 1 !important;
                background: rgba(255,255,255,0.05);
            }
            :global(.spin) {
                animation: spin 1s linear infinite;
                display: inline-block;
            }
            @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

function CinematicScanline({ logs, timestamp, type }) {
    const [displayIndex, setDisplayIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    // Auto-scroll logic
    useEffect(() => {
        // 0. Immediate completion for finished states
        if (type === 'deploy-success' || type === 'deploy-fail') {
            setDisplayIndex(logs.length - 1);
            setIsComplete(true);
            return;
        }

        // 1. Skip animation for old messages (older than 5 minutes)
        if (timestamp) {
            const age = Date.now() - new Date(timestamp).getTime();
            if (age > 5 * 60 * 1000) {
                setDisplayIndex(logs.length - 1);
                setIsComplete(true);
                return;
            }
        }

        // If we are already at the end, nothing to do (unless logs grew)
        if (displayIndex >= logs.length - 1) {
            setIsComplete(true);
            return;
        }

        setIsComplete(false);

        // Scan speed: faster if we are far behind, slower if we are caught up
        const distance = logs.length - displayIndex;
        // SLOW DOWN: 400ms base speed (was 250), speed up to 50ms if >10 lines behind
        const delay = distance > 10 ? 50 : 400;

        const timer = setTimeout(() => {
            setDisplayIndex(prev => prev + 1);
        }, delay);

        return () => clearTimeout(timer);
    }, [displayIndex, logs.length, timestamp]);

    const currentLine = logs[displayIndex] || '';
    let html = convert.toHtml(currentLine);

    // Auto-Colorize Diff syntax if this is a git-push
    if (type === 'git-push') {
        if (currentLine.startsWith('+') && !currentLine.startsWith('+++')) {
            html = `<span style="color: #4ade80">${html}</span>`;
        } else if (currentLine.startsWith('-') && !currentLine.startsWith('---')) {
            html = `<span style="color: #f87171">${html}</span>`;
        } else if (currentLine.startsWith('@@')) {
            html = `<span style="color: #60a5fa">${html}</span>`;
        } else if (currentLine.startsWith('diff') || currentLine.startsWith('index')) {
            html = `<span style="color: #fbbf24; font-weight: bold">${html}</span>`;
        }
    }
    const isBoring = /^(npm|yarn|download|copy|fetch|progress|> |\[\d+\/\d+\])|^\s*$/i.test(currentLine) || currentLine.includes('modules');

    return (
        <div style={{
            marginTop: '8px',
            padding: '12px',
            background: '#0d1117',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '12px',
            color: '#c9d1d9',
            minHeight: '48px', // Fixed height to prevent jitter
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Scanline Effect Overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 50%, rgba(32, 255, 77, 0.05) 51%, transparent 51%)',
                backgroundSize: '100% 4px',
                pointerEvents: 'none'
            }} />

            <style jsx>{`
                @keyframes scanline-entry {
                    0% { opacity: 0; transform: translateY(-4px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="flex-1" style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                    display: 'flex',
                    animation: 'scanline-entry 0.4s ease-out forwards',
                    gap: '8px',
                    alignItems: 'center',
                    opacity: isBoring ? 0.7 : 1,
                    transition: 'opacity 0.2s'
                }}>
                    <span style={{ color: '#2ecc71', fontSize: '10px' }}>➜</span>
                    <span
                        dangerouslySetInnerHTML={{ __html: html }}
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}
                    />
                </div>
            </div>

            {/* Progress Counter/Spinner */}
            <div style={{
                position: 'absolute',
                bottom: '4px',
                right: '6px',
                fontSize: '9px',
                color: '#444',
                fontFamily: 'monospace'
            }}>
                LINE {displayIndex + 1}/{logs.length}
                {!isComplete && <span className="animate-pulse ml-1">▋</span>}
            </div>
        </div>
    );
}
