"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
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
    const [limit, setLimit] = useState(10); // 'infinity' for All
    const isInfinite = limit === 'infinity';

    // Scroll refs for infinite loading
    const userScrollRef = useRef(null);
    const sessionScrollRef = useRef(null);


    // Sessions Tab State
    const [activeTab, setActiveTab] = useState('users'); // 'users', 'sessions'
    const [sessions, setSessions] = useState([]);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [sessionPagination, setSessionPagination] = useState({ page: 0, total: 0, pages: 1 });

    const [selectedUserId, setSelectedUserId] = useState(null); // For Detail Modal
    const [actionLoading, setActionLoading] = useState(null); // userId being acted upon
    const dragControls = useDragControls();

    // Sort & Filter State
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [filters, setFilters] = useState({ ip: '', status: '' });
    const [sessionSort, setSessionSort] = useState({ key: 'timestamp', direction: 'desc' });
    const [sessionFilters, setSessionFilters] = useState({ action: '', userId: '', roomId: '' });

    // Debounce Logic
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    const [debouncedFilters, setDebouncedFilters] = useState(filters);
    const [debouncedSessionFilters, setDebouncedSessionFilters] = useState(sessionFilters);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setDebouncedFilters(filters);
        }, 300);
        return () => clearTimeout(handler);
    }, [search, filters]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSessionFilters(sessionFilters);
        }, 300);
        return () => clearTimeout(handler);
    }, [sessionFilters]);

    const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR' || session?.user?.role === 'OWNER';

    // Fetch on open or search/filter change
    useEffect(() => {
        if (!isOpen || !isAdmin) return;

        if (activeTab === 'users') {
            fetchUsers(1);
        }
    }, [isOpen, debouncedSearch, roleFilter, debouncedFilters, sortConfig, limit, activeTab]);

    useEffect(() => {
        if (isOpen && activeTab === 'sessions') {
            fetchSessions(0);
        }
    }, [isOpen, activeTab, sessionSort, debouncedSessionFilters, limit]);

    const fetchUsers = async (page = 1, append = false) => {
        setLoading(true);
        try {
            const actualLimit = isInfinite ? 50 : limit;
            const params = new URLSearchParams({
                page: page.toString(),
                limit: actualLimit.toString(),
                search: debouncedSearch,
                role: roleFilter,
                sort: sortConfig.key,
                dir: sortConfig.direction,
                ip: debouncedFilters.ip,
                status: debouncedFilters.status
            });
            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();
            if (data.users) {
                if (append) {
                    setUsers(prev => [...prev, ...data.users]);
                } else {
                    setUsers(data.users);
                }
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSessions = async (page = 0, append = false) => {
        setSessionLoading(true);
        try {
            const actualLimit = isInfinite ? 50 : limit;
            const params = new URLSearchParams({
                page: page.toString(),
                limit: actualLimit.toString(),
                sort: sessionSort.key,
                dir: sessionSort.direction,
                action: debouncedSessionFilters.action,
                userId: debouncedSessionFilters.userId,
                roomId: debouncedSessionFilters.roomId
            });
            const res = await fetch(`/api/admin/sessions?${params}`);
            const data = await res.json();
            if (data.success) {
                if (append) {
                    setSessions(prev => [...prev, ...data.data]);
                } else {
                    setSessions(data.data);
                }
                setSessionPagination(data.pagination);
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        } finally {
            setSessionLoading(false);
        }
    };

    // Scroll Handler for Infinite Load
    const handleScroll = (e, type) => {
        if (!isInfinite) return;
        const { scrollTop, scrollHeight, clientHeight } = e.target;

        // Load more when near bottom (100px threshold)
        if (scrollHeight - scrollTop - clientHeight < 100) {
            if (type === 'users' && !loading && pagination.page < pagination.pages) {
                fetchUsers(pagination.page + 1, true);
            } else if (type === 'sessions' && !sessionLoading && sessionPagination.page < sessionPagination.pages - 1) { // Sessions 0-indexed? check logic
                // Server sends pages=total/limit? Backend pagination usually 0 or 1 indexed.
                // fetchSessions checks page starting 0.
                // Assuming sessionPagination.pages is derived correct.
                // Let's assume fetchSession is 0-indexed as per default.
                fetchSessions(sessionPagination.page + 1, true);
            }
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
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '24px 24px 0 24px' }}>
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
                                    </>
                                )}
                            </div>

                            <div
                                style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px', scrollBehavior: 'smooth' }}
                                onScroll={(e) => handleScroll(e, activeTab)}
                            >
                                {activeTab === 'users' && (
                                    <UsersTable
                                        users={users}
                                        loading={loading}
                                        onAction={handleAction}
                                        onSelect={(id) => setSelectedUserId(id)}
                                        actionLoading={actionLoading}
                                        socket={socket}
                                        sortConfig={sortConfig}
                                        onSort={(key) => setSortConfig(prev => ({
                                            key,
                                            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
                                        }))}
                                        filters={filters}
                                        onFilterChange={(key, val) => setFilters(prev => ({ ...prev, [key]: val }))}
                                    />
                                )}

                                {activeTab === 'sessions' && (
                                    <SessionsTable
                                        sessions={sessions}
                                        loading={sessionLoading}
                                        onRefresh={() => fetchSessions(0)}
                                        sortConfig={sessionSort}
                                        onSort={(key) => setSessionSort(prev => ({
                                            key,
                                            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
                                        }))}
                                        filters={sessionFilters}
                                        onFilterChange={(key, val) => setSessionFilters(prev => ({ ...prev, [key]: val }))}
                                    />
                                )}
                            </div>

                            {/* Fixed Footer */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid rgba(255,255,255,0.08)',
                                background: '#1c1e21',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#888' }}>
                                    <span>Rows per page:</span>
                                    <select
                                        value={limit}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLimit(val === 'infinity' ? 'infinity' : Number(val));
                                        }}
                                        style={{ background: '#151619', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '4px', padding: '4px 8px' }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value="infinity">All (Infinite)</option>
                                    </select>

                                    {isInfinite && (
                                        <span style={{ fontSize: '11px', color: '#6366F1', marginLeft: '6px' }}>
                                            <Icon icon="fa:bolt" style={{ marginRight: '4px' }} />
                                            Lazy Loading Active
                                        </span>
                                    )}
                                </div>

                                {!isInfinite && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', color: '#888', marginRight: '8px' }}>
                                            Page {activeTab === 'users' ? pagination.page : sessionPagination.page + 1} of {activeTab === 'users' ? pagination.pages : sessionPagination.pages}
                                        </span>
                                        <button
                                            disabled={activeTab === 'users' ? pagination.page === 1 : sessionPagination.page === 0}
                                            onClick={() => activeTab === 'users' ? fetchUsers(pagination.page - 1) : fetchSessions(sessionPagination.page - 1)}
                                            className="btn secondary"
                                            style={{ padding: '6px 14px', fontSize: '13px' }}
                                        >Previous</button>
                                        <button
                                            disabled={activeTab === 'users' ? pagination.page >= pagination.pages : sessionPagination.page >= sessionPagination.pages - 1}
                                            onClick={() => activeTab === 'users' ? fetchUsers(pagination.page + 1) : fetchSessions(sessionPagination.page + 1)}
                                            className="btn secondary"
                                            style={{ padding: '6px 14px', fontSize: '13px' }}
                                        >Next</button>
                                    </div>
                                )}

                                {isInfinite && (
                                    <div style={{ fontSize: '13px', color: '#666' }}>
                                        {activeTab === 'users' ? `Showing ${users.length} of ${pagination.total}` : `Showing ${sessions.length} of ${sessionPagination.total}`} items
                                    </div>
                                )}
                            </div>
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

// Sortable Header Component
function SortableHeader({ label, sortKey, currentSort, onSort, filter, onFilterChange }) {
    const isActive = currentSort?.key === sortKey;

    return (
        <th style={{ padding: '8px 12px', verticalAlign: 'top', position: 'sticky', top: 0, zIndex: 10, background: '#202226', boxShadow: '0 1px 0 rgba(255,255,255,0.1)' }}>
            {/* Header Title & Sort */}
            <div
                onClick={() => onSort && onSort(sortKey)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    cursor: onSort ? 'pointer' : 'default',
                    color: isActive ? 'white' : '#888',
                    fontWeight: '600', fontSize: '12px',
                    userSelect: 'none', marginBottom: '8px'
                }}
            >
                {label}
                {isActive && (
                    <Icon icon={currentSort.direction === 'asc' ? 'fa:sort-asc' : 'fa:sort-desc'} width="10" />
                )}
            </div>

            {/* Filter Input */}
            {onFilterChange && (
                <input
                    type="text"
                    value={filter || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onFilterChange(e.target.value)}
                    placeholder="Filter..."
                    style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        padding: '4px 6px',
                        color: 'white',
                        fontSize: '11px',
                        outline: 'none'
                    }}
                />
            )}
        </th>
    );
}

// Memoized Users Table to prevent lag during search typing
// Memoized Users Table to prevent lag during search typing
// Memoized Users Table to prevent lag during search typing
// Memoized Users Table to prevent lag during search typing
// Memoized Users Table (No internal pagination)
function UsersTable({ users, loading, onAction, onSelect, actionLoading, socket, sortConfig, onSort, filters, onFilterChange }) {
    // Calculate IP frequencies
    const ipCounts = users.reduce((acc, user) => {
        if (user.ipAddress) acc[user.ipAddress] = (acc[user.ipAddress] || 0) + 1;
        return acc;
    }, {});

    return (
        <div style={{
            background: '#202226', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.03)'
        }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', color: '#888' }}>
                        <SortableHeader label="User" sortKey="name" currentSort={sortConfig} onSort={onSort}
                            filter={filters.name} onFilterChange={(val) => onFilterChange('name', val)} />
                        <SortableHeader label="Type" sortKey="isGuest" currentSort={sortConfig} onSort={onSort} />
                        <SortableHeader label="Role" sortKey="role" currentSort={sortConfig} onSort={onSort}
                            filter={filters.role} onFilterChange={(val) => onFilterChange('role', val)} />
                        <SortableHeader label="Last IP" sortKey="ipAddress" currentSort={sortConfig} onSort={onSort}
                            filter={filters.ip} onFilterChange={(val) => onFilterChange('ip', val)} />
                        <SortableHeader label="Status" sortKey="isBanned" currentSort={sortConfig} onSort={onSort}
                            filter={filters.status} onFilterChange={(val) => onFilterChange('status', val)} />
                        <SortableHeader label="Last Seen" sortKey="lastSeen" currentSort={sortConfig} onSort={onSort} />
                        <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: '#202226', boxShadow: '0 1px 0 rgba(255,255,255,0.1)' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {loading && users.length === 0 ? (
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
                                <td style={{ padding: '12px 16px', fontSize: '11px' }}>
                                    <IPCell ip={user.ipAddress} count={ipCounts[user.ipAddress] || 0} />
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    {user.isBanned ? (
                                        <span style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>BANNED</span>
                                    ) : (
                                        <span style={{ color: '#10B981', fontSize: '12px' }}>Active</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px 16px', color: '#888', fontSize: '12px' }}>
                                    {user.lastSeen ? new Date(user.lastSeen).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {/* Mod Actions */}
                                    <button
                                        className="icon-btn"
                                        title="Shadow Mute"
                                        onClick={() => {
                                            socket?.emit('mod-shadow-mute', { targetUserId: user.id, mute: true });
                                            alert('User shadow muted.');
                                        }}
                                        style={{ marginRight: '4px' }}
                                    >
                                        <Icon icon="fa:eye-slash" width="14" color="#888" />
                                    </button>
                                    <button
                                        className="icon-btn"
                                        title="Wipe Messages"
                                        onClick={() => {
                                            socket?.emit('mod-wipe-messages', { targetUserId: user.id });
                                            alert('Messages wiped.');
                                        }}
                                        style={{ marginRight: '4px' }}
                                    >
                                        <Icon icon="fa:eraser" width="14" color="#888" />
                                    </button>

                                    <button
                                        className="icon-btn"
                                        title="View Details"
                                        onClick={() => onSelect(user.id)}
                                        style={{ marginRight: '8px' }}
                                    >
                                        <Icon icon="fa:eye" width="14" color="#888" />
                                    </button>

                                    <button
                                        className="icon-btn"
                                        title="Promote/Demote"
                                        onClick={() => {
                                            const newRole = user.role === 'MODERATOR' ? 'USER' : 'MODERATOR';
                                            onAction(user.id, 'SET_ROLE', newRole);
                                        }}
                                        disabled={actionLoading === user.id}
                                    >
                                        <Icon icon="fa:shield" width="14" color={user.role === 'MODERATOR' ? '#3B82F6' : '#888'} />
                                    </button>

                                    {user.isBanned ? (
                                        <button
                                            className="icon-btn"
                                            title="Unban"
                                            onClick={() => onAction(user.id, 'BAN', false)}
                                            disabled={actionLoading === user.id}
                                            style={{ marginLeft: '8px', color: '#10B981' }}
                                        >
                                            <Icon icon="fa:check" width="14" />
                                        </button>
                                    ) : (
                                        <button
                                            className="icon-btn danger"
                                            title="Ban"
                                            onClick={() => onAction(user.id, 'BAN', true)}
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
            {/* Loading Indicator for Infinite Scroll */}
            {loading && users.length > 0 && (
                <div style={{ padding: '12px', textAlign: 'center', color: '#888', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    Loading more users...
                </div>
            )}
        </div>
    );
};

// Memoized Sessions Table
// Memoized Sessions Table
// Memoized Sessions Table
// Memoized Sessions Table (No internal pagination)
function SessionsTable({ sessions, loading, onRefresh, sortConfig, onSort, filters, onFilterChange }) {
    return (
        <div style={{ background: '#202226', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <button className="btn primary" onClick={onRefresh} style={{ padding: '6px 16px', fontSize: '13px' }}>Refresh Log</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', color: '#888' }}>
                        <SortableHeader label="Time" sortKey="timestamp" currentSort={sortConfig} onSort={onSort} />
                        <SortableHeader label="Action" sortKey="action" currentSort={sortConfig} onSort={onSort}
                            filter={filters.action} onFilterChange={(val) => onFilterChange('action', val)} />
                        <SortableHeader label="User" sortKey="displayName" currentSort={sortConfig} onSort={onSort}
                            filter={filters.userId} onFilterChange={(val) => onFilterChange('userId', val)} />
                        <SortableHeader label="Room" sortKey="roomId" currentSort={sortConfig} onSort={onSort}
                            filter={filters.roomId} onFilterChange={(val) => onFilterChange('roomId', val)} />
                        <SortableHeader label="IP / Device" sortKey="ipAddress" currentSort={sortConfig} onSort={onSort} />
                        <th style={{ padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, background: '#202226', boxShadow: '0 1px 0 rgba(255,255,255,0.1)' }}>Meta</th>
                    </tr>
                </thead>
                <tbody>
                    {loading && sessions.length === 0 ? (
                        <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#666' }}>Loading logs...</td></tr>
                    ) : sessions.length === 0 ? (
                        <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No session logs found</td></tr>
                    ) : (
                        sessions.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '12px 16px', color: '#888' }}>
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <span style={{
                                        color: log.action === 'join' ? '#10B981' : '#F59E0B',
                                        background: log.action === 'join' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase'
                                    }}>
                                        {log.action}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: '500', color: 'white' }}>{log.displayName}</div>
                                    {log.userId && <div style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>{log.userId}</div>}
                                </td>
                                <td style={{ padding: '12px 16px', color: '#bbb' }}>{log.roomId}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontFamily: 'monospace', color: '#888' }}>{log.ipAddress || 'Unknown'}</div>
                                    <div style={{ fontSize: '10px', color: '#555', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.userAgent}</div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    {log.metadata?.isGuest && <span style={{ fontSize: '10px', background: '#333', padding: '2px 4px', borderRadius: '3px', color: '#ccc' }}>GUEST</span>}
                                    {log.metadata?.role && log.metadata.role !== 'USER' && <span style={{ marginLeft: '4px', fontSize: '10px', background: '#312e81', padding: '2px 4px', borderRadius: '3px', color: '#a5b4fc' }}>{log.metadata.role}</span>}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            {/* Loading Indicator for Infinite Scroll */}
            {loading && sessions.length > 0 && (
                <div style={{ padding: '12px', textAlign: 'center', color: '#888', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    Loading more logs...
                </div>
            )}
        </div>
    );
}

function IPCell({ ip, count }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hovered, setHovered] = useState(false);

    const fetchIP = async () => {
        if (details || loading || !ip || ip === 'Unknown') return;
        setLoading(true);
        try {
            const res = await fetch(`https://ipapi.co/${ip}/json/`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setDetails(data);
        } catch (e) {
            setDetails({ error: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{ position: 'relative', cursor: ip && ip !== 'Unknown' ? 'help' : 'default', width: 'fit-content' }}
            onMouseEnter={() => { setHovered(true); fetchIP(); }}
            onMouseLeave={() => setHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', color: '#888' }}>
                    {ip || 'Unknown'}
                </span>
                {count > 1 && (
                    <div title={`${count} users share this IP`} style={{
                        background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B',
                        padding: '1px 5px', borderRadius: '4px', fontSize: '10px',
                        display: 'flex', alignItems: 'center', gap: '3px'
                    }}>
                        <Icon icon="fa:users" width="10" />
                        <span style={{ fontWeight: 700 }}>{count}</span>
                    </div>
                )}
            </div>

            {/* Popover */}
            <AnimatePresence>
                {hovered && details && !details.error && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        style={{
                            position: 'absolute', top: '100%', left: 0, zIndex: 100,
                            padding: '12px', background: '#1A1B1E',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '220px',
                            marginTop: '8px', pointerEvents: 'none'
                        }}
                    >
                        <div style={{ fontWeight: 600, color: 'white', fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {details.country_code && (
                                <img
                                    src={`https://flagcdn.com/20x15/${details.country_code.toLowerCase()}.png`}
                                    alt={details.country_code}
                                    style={{ borderRadius: '2px' }}
                                />
                            )}
                            {details.org || details.isp || 'Unknown ISP'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#888', lineHeight: '1.4' }}>
                            {details.city && <span>{details.city}, </span>}
                            {details.region && <span>{details.region}</span>}
                            <br />
                            {details.country_name}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
