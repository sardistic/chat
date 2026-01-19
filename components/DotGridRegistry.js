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

// Ripple Presets - thin and fast
export const RIPPLE_PRESETS = {
    keystroke: { speed: 18, width: 25, maxRadius: 150, opacity: 0.18 },  // Quick thin pulse
    typing: { speed: 22, width: 35, maxRadius: 280, opacity: 0.28 },    // Fast visible breathing
    message: { speed: 16, width: 40, maxRadius: 350, opacity: 0.15 },   // Thin fast message ripple
    system: { speed: 14, width: 50, maxRadius: 450, opacity: 0.16 },    // Thin fast system events
};
