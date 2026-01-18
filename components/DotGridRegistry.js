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

// Ripple Presets
export const RIPPLE_PRESETS = {
    keystroke: { speed: 40, width: 200, growth: 1, opacity: 0.15 },
    typing: { speed: 35, width: 300, growth: 1.5, opacity: 0.2 },
    message: { speed: 25, width: 450, growth: 3, opacity: 0.4 },
    system: { speed: 30, width: 350, growth: 2, opacity: 0.3 },
};
