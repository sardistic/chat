import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import Convert from 'ansi-to-html';

const convert = new Convert({
    fg: '#ccc',
    newline: false,
    escapeXML: true
});

export default function SystemMessage({ message, onUserClick = () => { } }) {
    const { systemType, text, metadata } = message;

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
                background: 'rgba(255,255,255,0.03)', // Subtle bg
                borderRadius: '8px',
                margin: '4px 0',
                border: '1px solid rgba(255,255,255,0.05)'
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
                                    src={u.avatar || u.image || `/api/avatar/${u.name}`}
                                    alt={u.name}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        border: u.action && u.action.includes('left') ? '1px solid #666' : '1px solid #10b981',
                                        opacity: u.action && u.action.includes('left') ? 0.5 : 1,
                                        filter: u.action && u.action.includes('left') ? 'grayscale(100%)' : 'none',
                                        objectFit: 'cover'
                                    }}
                                    onError={(e) => {
                                        // Fallback to initial
                                        e.target.style.display = 'none';
                                        e.target.parentNode.style.backgroundColor = '#333';
                                        e.target.parentNode.style.display = 'flex';
                                        e.target.parentNode.style.alignItems = 'center';
                                        e.target.parentNode.style.justifyContent = 'center';
                                        e.target.parentNode.innerText = u.name?.charAt(0) || '?';
                                        e.target.parentNode.style.fontSize = '10px';
                                        e.target.parentNode.style.fontWeight = 'bold';
                                        e.target.parentNode.style.width = '24px';
                                        e.target.parentNode.style.height = '24px';
                                        e.target.parentNode.style.borderRadius = '50%';
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon icon="mdi:account-group-outline" width="14" />
                    <span>{text}</span>
                </div>
            </div>
        );
    }

    // Configuration for different message types
    const config = {
        'deploy-start': {
            icon: 'mdi:loading', // Clear loading spinner
            color: '#f59e0b', // Amber/Orange
            bgColor: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            kicker: 'MISSION CONTROL',
            animation: 'pulse-border',
            showProgress: true
        },
        'deploy-success': {
            icon: 'mdi:rocket-launch',
            color: '#10b981', // Emerald/Green
            bgColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.5)',
            kicker: 'DEPLOYMENT SUCCESSFUL',
            animation: 'success-glow'
        },
        'deploy-fail': {
            icon: 'mdi:alert-octagon',
            color: '#ef4444', // Red
            bgColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.4)',
            kicker: 'DEPLOYMENT FAILED',
            animation: 'shake'
        },
        'git-push': {
            icon: 'mdi:git',
            color: '#8b5cf6', // Violet
            bgColor: 'rgba(139, 92, 246, 0.1)',
            borderColor: 'rgba(139, 92, 246, 0.3)',
            kicker: 'CODE UPDATE',
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
                borderLeft: `2px solid ${style.borderColor}`,
                fontSize: '11px',
                fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", monospace',
                color: '#9ca3af',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                opacity: 0.85
            }}>
                {text}
            </div>
        );
    }

    return (
        <div className={`system-message-card ${style.animation}`} style={{
            margin: '12px 0',
            padding: '0',
            background: '#0a0a0a',
            border: `1px solid ${style.borderColor}`,
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            fontFamily: 'monospace, monospace', // Tech look
            boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.3)`
        }}>
            {/* Kicker / Header Bar */}
            <div style={{
                background: style.bgColor,
                padding: '4px 12px',
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
                {style.kicker}
            </div>

            {/* Content Body */}
            <div style={{
                padding: '12px',
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

                {/* Build Logs Terminal */}
                {metadata && metadata.logs && metadata.logs.length > 0 && (
                    <div className="terminal-window" style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#0d1117', // Github Dark Dimmed
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace', // Nerd fonts if available
                        fontSize: '11px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        color: '#c9d1d9',
                        display: 'flex',
                        flexDirection: 'column', // Standard top-to-bottom
                        gap: '2px'
                    }}>
                        {metadata.logs.map((line, i) => {
                            // Heuristics for boring lines (progress bars, downloads, repetitive info)
                            const isBoring = /^(npm|yarn|download|copy|fetch|progress|> |\[\d+\/\d+\])|^\s*$/i.test(line) || line.includes('modules');
                            const html = convert.toHtml(line);

                            return (
                                <div key={i}
                                    style={{
                                        opacity: isBoring ? 0.35 : 1,
                                        paddingLeft: line.startsWith(' ') ? '4px' : '0',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                        lineHeight: '1.4'
                                    }}
                                    className="log-line"
                                    dangerouslySetInnerHTML={{ __html: html }}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Extended Metadata (Commit info, etc.) */}
                {metadata && !metadata.logs && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '11px', color: '#888' }}>
                        {metadata.commit && <div>Commit: <span style={{ color: '#ccc' }}>{metadata.commit}</span></div>}
                        {metadata.author && <div>Author: <span style={{ color: '#ccc' }}>{metadata.author}</span></div>}
                        {metadata.duration && <div>Duration: <span style={{ color: '#ccc' }}>{metadata.duration}</span></div>}
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
            
            .spin {
                animation: spin 1s linear infinite;
            }
            @keyframes spin { 100% { transform: rotate(360deg); } }

            /* Progress Bar Animation */
            .progress-bar-container {
                height: 4px;
                width: 100%;
                background: rgba(0,0,0,0.3);
                overflow: hidden;
                position: relative;
            }
            .progress-bar-fill {
                height: 100%;
                width: 100%;
                background: repeating-linear-gradient(
                    45deg,
                    ${style.borderColor},
                    ${style.borderColor} 10px,
                    ${style.color} 10px,
                    ${style.color} 20px
                );
                animation: progress-slide 1s linear infinite;
            }
            @keyframes progress-slide {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
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
            `}</style>
        </div>
    );
}
