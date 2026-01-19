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

// Ripple Presets - increased visibility and speed
export const RIPPLE_PRESETS = {
    keystroke: { speed: 22, width: 30, growth: 1.5, maxRadius: 180, opacity: 0.25 },  // Quick thin pulse
    typing: { speed: 26, width: 40, growth: 2.0, maxRadius: 320, opacity: 0.35 },    // Fast visible breathing
    message: { speed: 20, width: 45, growth: 2.5, maxRadius: 400, opacity: 0.25 },   // Message ripple
    system: { speed: 18, width: 55, growth: 3.0, maxRadius: 500, opacity: 0.3 },     // System events
    join: { speed: 24, width: 60, growth: 3.5, maxRadius: 550, opacity: 0.4 },       // Join/leave - more visible!
};
