"use client";

import { useState } from "react";

export default function Sidebar({ user, onOpenSettings }) {
    const [activeTab, setActiveTab] = useState("users");

    const users = [
        { id: 1, name: "Admin", color: "#ff0000" },
        { id: 2, name: "Guest_123", color: "#00ff00" },
        { id: 3, name: "CoolUser", color: "#0000ff" },
    ];

    return (
        <aside className="sidebar glass-panel" style={{ borderRight: '1px solid var(--glass-border)' }}>
            <div className="p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <h1 className="text-gradient" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>SARDCHAT</h1>
            </div>

            <div className="flex-row p-2 gap-2">
                <button
                    onClick={() => setActiveTab("users")}
                    className={`btn-glass flex-1 ${activeTab === 'users' ? 'active' : ''}`}
                >
                    Users
                </button>
                <button
                    onClick={() => setActiveTab("rooms")}
                    className={`btn-glass flex-1 ${activeTab === 'rooms' ? 'active' : ''}`}
                >
                    Rooms
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === "users" && (
                    <div className="flex-col gap-2">
                        {users.map(user => (
                            <div key={user.id} className="flex-row items-center gap-2" style={{ fontSize: '0.9rem' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0f0', boxShadow: '0 0 5px #0f0' }}></div>
                                <span style={{ color: user.name === "Admin" ? "var(--accent-color)" : "var(--text-main)" }}>{user.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === "rooms" && (
                    <div className="flex-col gap-2">
                        <div className="btn-glass" style={{ textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-main)' }}># General</div>
                        <div className="btn-glass" style={{ textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-main)' }}># Music</div>
                    </div>
                )}
            </div>

            <div className="p-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Connected as <span style={{ color: user?.color || '#fff', fontWeight: 'bold' }}>{user?.name || 'Guest'}</span>
                </div>
                <button onClick={onOpenSettings} className="btn-glass p-1 rounded-full" title="Settings">⚙️</button>
            </div>
        </aside>
    );
}
