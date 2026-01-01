import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';

export default function SystemMessage({ message }) {
    const { systemType, text, metadata } = message;

    // Minimal style for join/leave events with optional Avatars
    if (systemType === 'join-leave') {
        const users = metadata?.users || [];

        return (
            <div style={{
                padding: '6px 12px',
                fontSize: '12px',
                color: '#9ca3af', // Gray-400 (Lighter)
                // fontStyle: 'italic', // Removed for readability
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
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                        {users.map((u, i) => (
                            <div key={i} className="relative group" title={u.name}>
                                <img
                                    src={`https://api.dicebear.com/9.x/dylan/svg?seed=${u.name}`}
                                    alt={u.name}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: u.action && u.action.includes('left') ? '1px solid #666' : '1px solid #10b981',
                                        opacity: u.action && u.action.includes('left') ? 0.5 : 1,
                                        filter: u.action && u.action.includes('left') ? 'grayscale(100%)' : 'none'
                                    }}
                                />
                                {u.action === 'cam-up' && (
                                    <div style={{
                                        position: 'absolute', bottom: -2, right: -2,
                                        width: '8px', height: '8px',
                                        background: '#f43f5e', borderRadius: '50%', border: '1px solid #000'
                                    }} />
                                )}
                            </div>
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
            icon: 'eos-icons:system-ok-outlined', // Spinning gear or similar
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
        }
    };

    const style = config[systemType] || config['info'];

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
                <Icon icon={style.icon} width="14" className={systemType === 'deploy-start' ? 'spin-slow' : ''} />
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

                {/* Extended Metadata (Commit info, etc.) */}
                {metadata && (
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

            {/* CSS Styles for Animations */}
            <style jsx>{`
        @keyframes pulse-border {
          0% { box-shadow: 0 0 0 0 ${style.borderColor}; }
          70% { box-shadow: 0 0 0 4px rgba(0, 0, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
        }
        @keyframes success-glow {
          0% { box-shadow: 0 0 5px ${style.color}; transform: scale(0.98); }
          50% { box-shadow: 0 0 20px ${style.color}; transform: scale(1.01); }
          100% { box-shadow: 0 0 10px ${style.color}; transform: scale(1); }
        }
        .pulse-border {
          animation: pulse-border 2s infinite;
        }
        .success-glow {
          animation: success-glow 1.5s ease-out;
          border-color: ${style.color} !important;
        }
        .spin-slow {
          animation: spin 3s linear infinite;
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
            100% { transform: translateX(100%); } /* Simplified infinite slide */
        }
      `}</style>
        </div>
    );
}
