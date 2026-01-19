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
    keystroke: { speed: 8, width: 60, maxRadius: 150, opacity: 0.04 },   // Very short range
    typing: { speed: 10, width: 100, maxRadius: 250, opacity: 0.06 },    // Short breathing wave
    message: { speed: 6, width: 300, maxRadius: 1500, opacity: 0.2 },    // Full screen ripple
    system: { speed: 5, width: 400, maxRadius: 2000, opacity: 0.25 },    // Large system events
};
