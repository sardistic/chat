"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Icon } from '@iconify/react';
import UserDetailModal from "./UserDetailModal";
import { motion, AnimatePresence, useDragControls } from "framer-motion";

export default function AdminModal({ isOpen, onClose, onlineCount }) {
    const { data: session } = useSession();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");

    const [selectedUserId, setSelectedUserId] = useState(null); // For Detail Modal
    const [actionLoading, setActionLoading] = useState(null); // userId being acted upon
    const dragControls = useDragControls();

    // Fetch on open or search/filter change
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            fetchUsers(1);
        }, search ? 300 : 0); // Debounce search

        return () => clearTimeout(timer);
    }, [isOpen, search, roleFilter]);

    const fetchUsers = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "10",
                search,
                role: roleFilter
            });
            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();
            if (data.users) {
                setUsers(data.users);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (userId, action, value) => {
        let reason = "";
        if (action === 'BAN' && value === true) {
            reason = prompt("Enter ban reason (optional):") || "No reason provided";
        } else if (action === 'KICK') {
            reason = prompt("Enter kick reason (optional):") || "No reason provided";
        }

        if (!confirm(`Are you sure you want to ${action.toLowerCase()} this user?`)) return;

        setActionLoading(userId);
        try {
            const res = await fetch('/api/admin/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, action, value, reason })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Action failed');
                return;
            }

            // Refresh list
            fetchUsers(pagination.page);
        } catch (error) {
            console.error(error);
            alert('Network error');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'Inter, sans-serif'
                    }}
                    onClick={onClose}
                >
                    <motion.div
                        drag
                        dragControls={dragControls}
                        dragListener={false}
                        dragMomentum={false}
                        dragElastic={0}
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            background: 'rgba(26, 27, 30, 0.8)',
                            borderRadius: '24px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            width: '1100px',
                            maxWidth: '95vw',
                            height: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 40px 100px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            onPointerDown={(e) => dragControls.start(e)}
                            style={{
                                padding: '24px 32px',
                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(21, 22, 25, 0.4)',
                                cursor: 'grab'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <motion.div
                                    whileHover={{ rotate: 15 }}
                                    style={{
                                        width: '44px', height: '44px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                                        color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
                                    }}
                                >
                                    <Icon icon="fa:shield" width="22" />
                                </motion.div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: '#fff' }}>Mission Control</h2>
                                    <div style={{ fontSize: '13px', color: '#888', fontWeight: '500' }}>v2.2 • Administrator Dashboard</div>
                                </div>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.1)' }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onClose}
                                style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.05)', border: 'none',
                                    color: '#888', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                <Icon icon="fa:times" width="16" />
                            </motion.button>
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                                <StatCard label="Total Users" value={pagination.total} icon="fa:users" />
                                <StatCard label="Online" value={onlineCount || 0} icon="fa:circle" color="#10B981" />
                                <StatCard label="Reports" value="0" icon="fa:flag" color="#EF4444" />
                                <StatCard label="Status" value="OK" icon="fa:server" color="#3B82F6" />
                            </div>

                            {/* Toolbar */}
                            <div style={{
                                marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center',
                                background: '#202226', padding: '12px', borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.03)'
                            }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Icon icon="fa:search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                                    <input
                                        type="text"
                                        placeholder="Search users by name, email, or ID..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        style={{
                                            width: '100%', padding: '8px 12px 8px 36px',
                                            background: '#151619', border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px', color: 'white', outline: 'none', fontSize: '14px'
                                        }}
                                    />
                                </div>

                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    style={{
                                        padding: '8px 12px', background: '#151619',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                                        color: 'white', outline: 'none', fontSize: '14px'
                                    }}
                                >
                                    <option value="">All Roles</option>
                                    <option value="USER">User</option>
                                    <option value="MODERATOR">Moderator</option>
                                    <option value="ADMIN">Admin</option>
                                </select>

                                <button
                                    className="btn primary"
                                    onClick={() => fetchUsers(pagination.page)}
                                    style={{ padding: '8px 16px', height: '35px' }}
                                >
                                    Refresh
                                </button>
                            </div>

                            {/* Table */}
                            <div style={{
                                background: '#202226', borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.03)', overflow: 'hidden'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', color: '#888' }}>
                                            <th style={{ padding: '12px 16px', fontWeight: '500' }}>User</th>
                                            <th style={{ padding: '12px 16px', fontWeight: '500' }}>Type</th>
                                            <th style={{ padding: '12px 16px', fontWeight: '500' }}>Role</th>
                                            <th style={{ padding: '12px 16px', fontWeight: '500' }}>Last IP</th>
                                            <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                                            <th style={{ padding: '12px 16px', fontWeight: '500' }}>Activity</th>
                                            <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading users...</td></tr>
                                        ) : users.length === 0 ? (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No users found</td></tr>
                                        ) : (
                                            users.map(user => (
                                                <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <img
                                                                src={user.avatarUrl || user.image || `/api/avatar/${user.displayName || user.name || user.id}`}
                                                                alt=""
                                                                style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#333', objectFit: 'cover' }}
                                                            />
                                                            <div>
                                                                <div style={{ fontWeight: '500', color: 'white' }}>
                                                                    {user.displayName || user.name || 'Unknown'} {user.isGuest && <span style={{ opacity: 0.5, fontSize: '10px' }}>(Guest)</span>}
                                                                </div>
                                                                <div style={{ fontSize: '11px', color: '#666' }}>{user.email || user.discordId || 'No Email'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{
                                                            fontSize: '11px',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: user.isGuest ? 'rgba(255,255,255,0.05)' : 'rgba(99, 102, 241, 0.1)',
                                                            color: user.isGuest ? '#888' : '#6366F1'
                                                        }}>
                                                            {user.isGuest ? 'Guest' : 'Member'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <Badge role={user.role} />
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: '#888', fontFamily: 'monospace', fontSize: '11px' }}>
                                                        {user.ipAddress || 'Unknown'}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        {user.isBanned ? (
                                                            <span style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>BANNED</span>
                                                        ) : (
                                                            <span style={{ color: '#10B981', fontSize: '12px' }}>Active</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: '#888', fontSize: '12px' }}>
                                                        {user.lastSeen ? new Date(user.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <button
                                                            className="icon-btn"
                                                            title="View Details"
                                                            onClick={() => setSelectedUserId(user.id)}
                                                            style={{ marginRight: '8px' }}
                                                        >
                                                            <Icon icon="fa:eye" width="14" color="#888" />
                                                        </button>

                                                        <button
                                                            className="icon-btn"
                                                            title="Promote/Demote"
                                                            onClick={() => {
                                                                const newRole = user.role === 'MODERATOR' ? 'USER' : 'MODERATOR';
                                                                handleAction(user.id, 'SET_ROLE', newRole);
                                                            }}
                                                            disabled={actionLoading === user.id}
                                                        >
                                                            <Icon icon="fa:shield" width="14" color={user.role === 'MODERATOR' ? '#3B82F6' : '#888'} />
                                                        </button>

                                                        {user.isBanned ? (
                                                            <button
                                                                className="icon-btn"
                                                                title="Unban"
                                                                onClick={() => handleAction(user.id, 'BAN', false)}
                                                                disabled={actionLoading === user.id}
                                                                style={{ marginLeft: '8px', color: '#10B981' }}
                                                            >
                                                                <Icon icon="fa:check" width="14" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="icon-btn danger"
                                                                title="Ban"
                                                                onClick={() => handleAction(user.id, 'BAN', true)}
                                                                disabled={actionLoading === user.id}
                                                                style={{ marginLeft: '8px' }}
                                                            >
                                                                <Icon icon="fa:ban" width="14" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>

                                {/* Pagination */}
                                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                    <button
                                        disabled={pagination.page === 1}
                                        onClick={() => fetchUsers(pagination.page - 1)}
                                        className="btn secondary"
                                        style={{ padding: '4px 12px', fontSize: '12px' }}
                                    >Previous</button>
                                    <span style={{ padding: '6px', fontSize: '12px', color: '#888' }}>
                                        Page {pagination.page} of {pagination.pages}
                                    </span>
                                    <button
                                        disabled={pagination.page >= pagination.pages}
                                        onClick={() => fetchUsers(pagination.page + 1)}
                                        className="btn secondary"
                                        style={{ padding: '4px 12px', fontSize: '12px' }}
                                    >Next</button>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {selectedUserId && (
                        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function StatCard({ label, value, icon, color = '#6366F1' }) {
    return (
        <div style={{ background: '#202226', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${color}20`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={icon} width="20" />
            </div>
            <div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: '600' }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>{value}</div>
            </div>
        </div>
    );
}

function Badge({ role }) {
    let color = '#888';
    if (role === 'ADMIN') color = '#EF4444';
    if (role === 'MODERATOR') color = '#3B82F6';
    if (role === 'OWNER') color = '#F59E0B';

    return (
        <span style={{
            color: color,
            border: `1px solid ${color}40`,
            padding: '2px 6px', borderRadius: '4px',
            fontSize: '10px', fontWeight: '600',
            textTransform: 'uppercase'
        }}>
            {role || 'USER'}
        </span>
    );
}
