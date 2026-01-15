"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Icon } from '@iconify/react';
import UserDetailModal from "./UserDetailModal";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useSocket } from "@/lib/socket";

export default function AdminModal({ isOpen, onClose, onlineCount }) {
    const { data: session } = useSession();
    const { socket } = useSocket();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");

    // Sessions Tab State
    const [activeTab, setActiveTab] = useState('users'); // 'users', 'sessions'
    const [sessions, setSessions] = useState([]);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [sessionPagination, setSessionPagination] = useState({ page: 0, total: 0, pages: 1 });

    const [selectedUserId, setSelectedUserId] = useState(null); // For Detail Modal
    const [actionLoading, setActionLoading] = useState(null); // userId being acted upon
    const dragControls = useDragControls();

    const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR' || session?.user?.role === 'OWNER';

    // Fetch on open or search/filter change
    useEffect(() => {
        if (!isOpen || !isAdmin) return;

        if (activeTab === 'users') {
            const timer = setTimeout(() => {
                fetchUsers(1);
            }, search ? 300 : 0);
            return () => clearTimeout(timer);
        } else if (activeTab === 'sessions') {
            fetchSessions(0);
        }
    }, [isOpen, search, roleFilter, activeTab]);

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

    const fetchSessions = async (page = 0) => {
        setSessionLoading(true);
        try {
            const res = await fetch(`/api/admin/sessions?page=${page}&limit=20`);
            const data = await res.json();
            if (data.success) {
                setSessions(data.data);
                setSessionPagination(data.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        } finally {
            setSessionLoading(false);
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
                // If 401/403, just return quietly to avoid spamming console with error parsing if text
                if (res.status === 401 || res.status === 403) return;
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
                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
                                <button onClick={() => setActiveTab('users')} style={{ padding: '8px 24px', borderRadius: '8px', background: activeTab === 'users' ? '#6366F1' : 'transparent', color: activeTab === 'users' ? 'white' : '#888', border: 'none', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>Users</button>
                                <button onClick={() => setActiveTab('sessions')} style={{ padding: '8px 24px', borderRadius: '8px', background: activeTab === 'sessions' ? '#6366F1' : 'transparent', color: activeTab === 'sessions' ? 'white' : '#888', border: 'none', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>Sessions</button>
                            </div>

                            {activeTab === 'users' && (
                                <>
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
                                                placeholder="Search users..."
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

                                    {/* Table (Memoized) */}
                                    <UsersTable
                                        users={users}
                                        loading={loading}
                                        pagination={pagination}
                                        onPageChange={(p) => fetchUsers(p)}
                                        onAction={handleAction}
                                        onSelect={(id) => setSelectedUserId(id)}
                                        actionLoading={actionLoading}
                                        socket={socket}
                                    />
                                </>
                            )}

                            {activeTab === 'sessions' && (
                                <SessionsTable
                                    sessions={sessions}
                                    loading={sessionLoading}
                                    pagination={sessionPagination}
                                    onPageChange={(p) => fetchSessions(p)}
                                    onRefresh={() => fetchSessions(0)}
                                />
                            )}
                        </div>
                    </motion.div>

                    {selectedUserId && (
                        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
                    )}
                </motion.div>
            )}
        </AnimatePresence >
    );
}

// Stats
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
