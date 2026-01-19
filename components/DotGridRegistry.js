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

// Ripple Presets - fast and dynamic
export const RIPPLE_PRESETS = {
    keystroke: { speed: 15, width: 40, maxRadius: 120, opacity: 0.08 },  // Quick tiny pulse
    typing: { speed: 18, width: 60, maxRadius: 200, opacity: 0.12 },    // Fast visible breathing
    message: { speed: 12, width: 150, maxRadius: 600, opacity: 0.15 },  // Snappy medium ripple
    system: { speed: 10, width: 200, maxRadius: 800, opacity: 0.18 },   // Quick system events
};
