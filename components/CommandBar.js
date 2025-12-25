"use client";

import { useState } from "react";

export default function CommandBar({ user, onOpenSettings }) {
    return (
        <div className="command-bar glass-panel flex items-center justify-between px-4 py-2 mb-2 rounded-xl">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gradient tracking-tighter">SARDCHAT</h1>
                <div className="h-6 w-[1px] bg-glass-border"></div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Broadcast:</span>
                    {/* Placeholder for Cam Status toggle - "Cam Down" in reference */}
                    <div className="flex items-center gap-1 bg-black/40 rounded-full p-1 border border-glass-border">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_5px_red]"></div>
                        <span className="text-xs font-bold px-2 text-white">OFF AIR</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm bg-black/20 py-1 px-3 rounded-lg border border-transparent hover:border-glass-border transition-colors cursor-default">
                    <span className="text-text-muted">Identity:</span>
                    <span style={{ color: user?.color || '#fff', fontWeight: 'bold' }}>{user?.name || 'Guest'}</span>
                </div>

                <button
                    onClick={onOpenSettings}
                    className="btn-glass p-2 rounded-lg hover:bg-white/10 transition-colors"
                    title="Settings"
                >
                    ⚙️
                </button>
            </div>
        </div>
    );
}
