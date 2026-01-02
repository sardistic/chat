"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from '@iconify/react';
import UserDetailModal from "./UserDetailModal";

export default function AdminDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('users');

    // User Management State
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");

    const [selectedUserId, setSelectedUserId] = useState(null); // For Detail Modal
    const [actionLoading, setActionLoading] = useState(null); // userId being acted upon

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            // Check roles
            const role = session.user?.role?.toUpperCase();
            if (!['ADMIN', 'MODERATOR', 'OWNER'].includes(role)) {
                router.push("/");
            } else {
                fetchUsers();
            }
        }
    }, [status, session, router]);

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
        if (!confirm(`Are you sure you want to ${action.toLowerCase()} this user?`)) return;

        setActionLoading(userId);
        try {
            const res = await fetch('/api/admin/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, action, value })
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
        <div style={{ minHeight: '100vh', background: '#0f1115', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>

            {/* Sidebar / Nav */}
            <div style={{
                height: '60px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', padding: '0 24px',
                background: '#1a1b1e'
            }}>
                <div style={{ fontWeight: '700', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon icon="fa:shield" color="var(--accent-primary)" />
                    Mission Control
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>
                    <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon icon="fa:home" /> Back to App
                    </button>
                </div>
            </div>

            <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>

                {/* Stats Header (Placeholder) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    <StatCard label="Total Users" value={pagination.total} icon="fa:users" />
                    <StatCard label="Online Now" value="--" icon="fa:circle" color="#10B981" />
                    <StatCard label="Reports" value="0" icon="fa:flag" color="#EF4444" />
                    <StatCard label="Server Status" value="Healthy" icon="fa:server" color="#3B82F6" />
                </div>

                {/* Main Content */}
                <div style={{ background: '#1a1b1e', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>

                    {/* Toolbar */}
                    <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                            <Icon icon="fa:search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    width: '100%', padding: '8px 12px 8px 36px',
                                    background: '#24262b', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px', color: 'white'
                                }}
                            />
                        </div>

                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            style={{
                                padding: '8px 12px', background: '#24262b',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white'
                            }}
                        >
                            <option value="">All Roles</option>
                            <option value="USER">User</option>
                            <option value="MODERATOR">Moderator</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>

                    {/* Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', color: '#888' }}>
                                <th style={{ padding: '12px 16px', fontWeight: '500' }}>User</th>
                                <th style={{ padding: '12px 16px', fontWeight: '500' }}>Role</th>
                                <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                                <th style={{ padding: '12px 16px', fontWeight: '500' }}>Joined</th>
                                <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <img
                                                src={user.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                                alt=""
                                                style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#333' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: '500', color: 'white' }}>{user.name || 'Unknown'}</div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>{user.email || user.discordId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <Badge role={user.role} />
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {user.isBanned ? (
                                            <span style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>BANNED</span>
                                        ) : (
                                            <span style={{ color: '#10B981', fontSize: '12px' }}>Active</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#888' }}>
                                        {new Date(user.createdAt).toLocaleDateString()}
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
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => fetchUsers(pagination.page - 1)}
                            className="btn secondary"
                        >Previous</button>
                        <span style={{ padding: '8px', fontSize: '14px', color: '#888' }}>
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <button
                            disabled={pagination.page >= pagination.pages}
                            onClick={() => fetchUsers(pagination.page + 1)}
                            className="btn secondary"
                        >Next</button>
                    </div>

                </div>

                {selectedUserId && (
                    <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
                )}

            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color = '#6366F1' }) {
    return (
        <div style={{ background: '#1a1b1e', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}20`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={icon} width="24" />
            </div>
            <div>
                <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', fontWeight: '600' }}>{label}</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>{value}</div>
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
            padding: '2px 8px', borderRadius: '4px',
            fontSize: '11px', fontWeight: '600',
            textTransform: 'uppercase'
        }}>
            {role || 'USER'}
        </span>
    );
}
