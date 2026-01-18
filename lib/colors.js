// Generate a deterministic color from a username using HSL for uniform brightness, returned as HEX
export function getUserColor(name) {
    if (!name) return '#5865F2'; // Default Discord Blurple-ish

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Curated spectrum of nice bright colors
    const colors = [
        '#FF6B6B', // Red
        '#4ECDC4', // Teal
        '#45B7D1', // Blue
        '#96CEB4', // Green
        '#FFEEAD', // Yellow
        '#D4A5A5', // Pink
        '#9B59B6', // Purple
        '#3498DB', // Blue
        '#E74C3C', // Red
        '#2ECC71', // Green
        '#F1C40F', // Yellow
    ];

    return colors[Math.abs(hash) % colors.length];
}
