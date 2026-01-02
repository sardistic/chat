"use client";
import { useState, useEffect } from "react";
import { Icon } from '@iconify/react';
import { motion, useDragControls } from "framer-motion";

export default function UserDetailModal({ userId, onClose }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const dragControls = useDragControls();

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        fetch(`/api/admin/users/${userId}`)
            .then(res => res.json())
            .then(data => {
                if (data.user) setUser(data.user);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [userId]);

    if (!userId) return null;

    const modalStyle = {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        background: "#1a1b1e",
        borderRadius: "12px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
        width: "600px",
        maxWidth: "90vw",
        height: "500px",
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(255,255,255,0.1)"
    };

    const overlayStyle = {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(5px)",
        zIndex: 9999
    };

    if (loading) {
        return (
            <div style={overlayStyle}>
                <div style={modalStyle}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                        Loading...
                    </div>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div style={overlayStyle} onClick={onClose}>
            <motion.div
                drag
                dragControls={dragControls}
                dragListener={false}
                dragMomentum={false}
                dragElastic={0}
                style={modalStyle}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    onPointerDown={(e) => dragControls.start(e)}
                    style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'grab' }}
                >
                    <img
                        src={user.avatarUrl || user.image || `/api/avatar/${user.displayName || user.name || user.id}`}
                        alt=""
                        style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#333', objectFit: 'cover' }}
                    />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                            {user.displayName || user.name || 'Unknown'}
                            {user.isGuest && <span style={{ opacity: 0.5, fontSize: '14px', fontWeight: '400', marginLeft: '8px' }}>(Guest)</span>}
                        </h2>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                            {user.email || user.discordId || 'No Email'} • <span style={{ fontFamily: 'monospace' }}>{user.id}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <Icon icon="fa:times" width="20" />
                    </button>
                </div>


                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 24px' }}>
                    {['overview', 'history'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '12px 0',
                                marginRight: '24px',
                                background: 'none',
                                border: 'none',
                                color: activeTab === tab ? 'white' : '#888',
                                borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                fontWeight: activeTab === tab ? '600' : '400'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {activeTab === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr', gap: '8px', fontSize: '14px' }}>
                                <div style={{ color: '#888' }}>Role</div>
                                <div>{user.role || 'USER'}</div>

                                <div style={{ color: '#888' }}>Joined</div>
                                <div>{new Date(user.createdAt).toLocaleString()}</div>

                                <div style={{ color: '#888' }}>IP Address</div>
                                <div style={{ fontFamily: 'monospace' }}>{user.ipAddress || 'Unknown'}</div>

                                <div style={{ color: '#888' }}>Discord ID</div>
                                <div>{user.discordId || 'N/A'}</div>

                                <div style={{ color: '#888' }}>Status</div>
                                <div>
                                    {user.isBanned ? <span style={{ color: '#ef4444' }}>Banned</span> : <span style={{ color: '#10b981' }}>Active</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div>
                            {(!user.auditLogsTarget || user.auditLogsTarget.length === 0) ? (
                                <div style={{ color: '#888', textAlign: 'center', padding: '40px' }}>No history found.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {user.auditLogsTarget.map(log => (
                                        <div key={log.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: '600', color: log.action.includes('BAN') ? '#ef4444' : '#fff' }}>{log.action}</span>
                                                <span style={{ color: '#666', fontSize: '11px' }}>{new Date(log.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div style={{ color: '#aaa', marginBottom: '8px' }}>
                                                {typeof log.details === 'object' && log.details !== null ? (log.details.reason || log.details.newRole || 'No additional details') : (log.details || 'No details')}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#666' }}>
                                                <Icon icon="fa:user-secret" />
                                                By {log.actor?.name || 'System'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </motion.div>
        </div>
    );
}
