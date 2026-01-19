"use client";

// Global registry for tile positions
export const tilePositions = new Map();

export function registerTilePosition(username, x, y) {
    tilePositions.set(username, { x, y });
    // console.log(`[TilePos] Registered ${username} at (${Math.round(x)}, ${Math.round(y)})`);
}

export function unregisterTilePosition(username) {
    tilePositions.delete(username);
}

export function getTilePosition(username) {
    return tilePositions.get(username) || null;
}

// Global ripple event bus
export const rippleCallbacks = new Set();

export function triggerDotRipple(type = 'message', origin = null, color = '#ffffff', intensity = 1.0) {
    rippleCallbacks.forEach(cb => cb(type, origin, color, intensity));
}

// Ripple Presets - typing subtle, events more prominent
export const RIPPLE_PRESETS = {
    keystroke: { speed: 8, width: 80, growth: 0.3, opacity: 0.05 },  // Very subtle
    typing: { speed: 10, width: 120, growth: 0.5, opacity: 0.08 },   // Subtle breathing
    message: { speed: 6, width: 300, growth: 2.0, opacity: 0.25 },   // Visible but gentle
    system: { speed: 5, width: 400, growth: 2.5, opacity: 0.3 },     // Larger for system events
};
