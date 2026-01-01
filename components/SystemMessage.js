import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';

export default function SystemMessage({ message }) {
    const { systemType, text } = message;

    // Configuration for different message types
    const config = {
        'deploy-start': {
            icon: 'eos-icons:system-ok-outlined', // Spinning gear or similar
            color: '#f59e0b', // Amber/Orange
            bgColor: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            kicker: 'MISSION CONTROL',
            animation: 'pulse-border'
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
                {/* Using ReactMarkdown to render the links and bold text safely */}
                <ReactMarkdown
                    components={{
                        p: ({ node, ...props }) => <div {...props} />, // Render paragraphs as divs to avoid margin issues
                        a: ({ node, ...props }) => <a {...props} style={{ color: style.color, textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" />
                    }}
                >
                    {text}
                </ReactMarkdown>
            </div>

            {/* CSS Styles for Animations - Injected here for component isolation */}
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
      `}</style>
        </div>
    );
}
