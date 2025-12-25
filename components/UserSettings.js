"use client";

import { useState } from "react";

export default function UserSettings({ currentName, currentColor, onSave, onClose }) {
    const [name, setName] = useState(currentName);
    const [color, setColor] = useState(currentColor);

    const colors = [
        "#ff0055", // Accent Red
        "#00f3ff", // Neon Cyan
        "#bc13fe", // Neon Purple
        "#00ff00", // Green
        "#ffff00", // Yellow
        "#ffaa00", // Orange
    ];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div className="glass-panel p-6 rounded-2xl w-96 flex flex-col gap-4 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-white">✕</button>

                <h2 className="text-xl font-bold text-gradient">Identity</h2>

                <div className="flex flex-col gap-2">
                    <label className="text-sm text-text-muted">Display Name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-black/30 border border-glass-border rounded-lg p-2 text-white focus:border-primary-neon outline-none"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm text-text-muted">Name Color</label>
                    <div className="flex gap-2 flex-wrap">
                        {colors.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-white' : ''}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => onSave(name, color)}
                    className="btn-glass bg-primary-neon/20 text-white mt-4 border-primary-neon hover:bg-primary-neon hover:text-black font-bold"
                >
                    Save Identity
                </button>
            </div>
        </div>
    );
}
