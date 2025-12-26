"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState({ role: "", isGuest: "" });
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

    // Check admin access
    useEffect(() => {
        if (status === "loading") return;
        if (!session?.user || session.user.role !== "ADMIN") {
            router.push("/");
        }
    }, [session, status, router]);

    // Fetch users
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: "20",
            });
            if (search) params.set("search", search);
            if (filter.role) params.set("role", filter.role);
            if (filter.isGuest) params.set("isGuest", filter.isGuest);

            const res = await fetch(`/api/admin/users?${params}`);
            const data = await res.json();

            if (data.users) {
                setUsers(data.users);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch users:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session?.user?.role === "ADMIN") {
            fetchUsers();
        }
    }, [session, pagination.page, search, filter]);

    // Action handlers
    const handleRoleChange = async (userId, newRole) => {
        try {
            await fetch(`/api/admin/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            fetchUsers();
        } catch (err) {
            console.error("Failed to update role:", err);
        }
    };

    const handleBan = async (userId, isBanned, reason = "") => {
        try {
            await fetch(`/api/admin/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isBanned, banReason: reason }),
            });
            fetchUsers();
        } catch (err) {
            console.error("Failed to update ban status:", err);
        }
    };

    const handleDelete = async (userId) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        try {
            await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
            fetchUsers();
        } catch (err) {
            console.error("Failed to delete user:", err);
        }
    };

    if (status === "loading" || (session?.user?.role !== "ADMIN" && status !== "unauthenticated")) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "white" }}>
                <div>Loading...</div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "24px" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                    <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>👑 Admin Dashboard</h1>
                    <button
                        onClick={() => router.push("/")}
                        style={{ background: "rgba(255,255,255,0.1)", border: "none", padding: "8px 16px", borderRadius: "8px", color: "white", cursor: "pointer" }}
                    >
                        ← Back to Chat
                    </button>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "24px", fontWeight: "bold" }}>{pagination.total}</div>
                        <div style={{ fontSize: "12px", color: "#888" }}>Total Users</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "24px", fontWeight: "bold" }}>{users.filter(u => u.isGuest).length}</div>
                        <div style={{ fontSize: "12px", color: "#888" }}>Guests (this page)</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "24px", fontWeight: "bold" }}>{users.filter(u => u.discordId).length}</div>
                        <div style={{ fontSize: "12px", color: "#888" }}>Discord Users (this page)</div>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", flex: "1", minWidth: "200px" }}
                    />
                    <select
                        value={filter.role}
                        onChange={(e) => setFilter({ ...filter, role: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white" }}
                    >
                        <option value="">All Roles</option>
                        <option value="USER">User</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    <select
                        value={filter.isGuest}
                        onChange={(e) => setFilter({ ...filter, isGuest: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white" }}
                    >
                        <option value="">All Types</option>
                        <option value="true">Guests Only</option>
                        <option value="false">Registered Only</option>
                    </select>
                </div>

                {/* Users Table */}
                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "12px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#888" }}>User</th>
                                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#888" }}>Type</th>
                                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#888" }}>Role</th>
                                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#888" }}>Status</th>
                                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#888" }}>Last Seen</th>
                                <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#888" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#888" }}>Loading...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#888" }}>No users found</td></tr>
                            ) : users.map((user) => (
                                <tr key={user.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                    <td style={{ padding: "12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <img
                                                src={user.image || user.avatarUrl || `/api/avatar/${user.displayName || user.name}?v=${user.avatarSeed || 0}`}
                                                alt=""
                                                style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#333" }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: "500" }}>{user.displayName || user.name || "Unknown"}</div>
                                                <div style={{ fontSize: "11px", color: "#888" }}>{user.email || user.discordTag || user.id.slice(0, 8)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        {user.discordId ? (
                                            <span style={{ background: "#5865F2", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>Discord</span>
                                        ) : user.isGuest ? (
                                            <span style={{ background: "#666", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>Guest</span>
                                        ) : (
                                            <span style={{ background: "#333", padding: "2px 8px", borderRadius: "4px", fontSize: "11px" }}>User</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            style={{ background: "rgba(255,255,255,0.1)", border: "none", padding: "4px 8px", borderRadius: "4px", color: "white", fontSize: "12px" }}
                                        >
                                            <option value="USER">User</option>
                                            <option value="MODERATOR">Mod</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        {user.isBanned ? (
                                            <span style={{ color: "#F87171" }}>🚫 Banned</span>
                                        ) : (
                                            <span style={{ color: "#4ADE80" }}>✓ Active</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "12px", fontSize: "12px", color: "#888" }}>
                                        {new Date(user.lastSeen).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: "12px", textAlign: "right" }}>
                                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                            <button
                                                onClick={() => handleBan(user.id, !user.isBanned, user.isBanned ? "" : "Banned by admin")}
                                                style={{ background: user.isBanned ? "#4ADE80" : "#F87171", border: "none", padding: "4px 8px", borderRadius: "4px", color: "white", fontSize: "11px", cursor: "pointer" }}
                                            >
                                                {user.isBanned ? "Unban" : "Ban"}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                style={{ background: "rgba(255,255,255,0.1)", border: "none", padding: "4px 8px", borderRadius: "4px", color: "#888", fontSize: "11px", cursor: "pointer" }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                            style={{ background: "rgba(255,255,255,0.1)", border: "none", padding: "8px 16px", borderRadius: "8px", color: "white", cursor: pagination.page === 1 ? "not-allowed" : "pointer", opacity: pagination.page === 1 ? 0.5 : 1 }}
                        >
                            Previous
                        </button>
                        <span style={{ padding: "8px 16px", color: "#888" }}>
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <button
                            disabled={pagination.page === pagination.pages}
                            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                            style={{ background: "rgba(255,255,255,0.1)", border: "none", padding: "8px 16px", borderRadius: "8px", color: "white", cursor: pagination.page === pagination.pages ? "not-allowed" : "pointer", opacity: pagination.page === pagination.pages ? 0.5 : 1 }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
