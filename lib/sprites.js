// Procedural sprite generator - creates unique characters from parts
export function generateProceduralSprite(seed) {
    // Determine seed value
    let seedValue;
    if (typeof seed === 'string') {
        // Simple string hash
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        }
        seedValue = Math.abs(hash);
    } else {
        seedValue = seed;
    }

    const random = (min = 0, max = 1) => {
        const x = Math.sin(seedValue++) * 10000;
        return min + (x - Math.floor(x)) * (max - min);
    };
    const randInt = (min, max) => Math.floor(random(min, max + 1));
    const choice = (arr) => arr[randInt(0, arr.length - 1)];

    const bodyShapes = ['round', 'tall', 'wide', 'blob', 'triangle', 'square', 'diamond', 'star'];
    const eyeStyles = ['dots', 'happy', 'sleepy', 'angry', 'sparkle', 'heart', 'star', 'spiral', 'robot', 'cat'];
    const mouthStyles = ['smile', 'grin', 'frown', 'fangs', 'tiny', 'wavy', 'zigzag', 'heart', 'none'];
    const accessories = ['none', 'hat', 'bow', 'horns', 'halo', 'antenna', 'crown', 'flower', 'headphones', 'wings'];
    const patterns = ['solid', 'spots', 'stripes', 'gradient', 'sparkles', 'checkers'];

    return {
        bodyShape: choice(bodyShapes),
        eyeStyle: choice(eyeStyles),
        mouthStyle: choice(mouthStyles),
        accessory: choice(accessories),
        pattern: choice(patterns),
        size: random(0.8, 1.2),
        rotation: randInt(-5, 5),
        seed: seedValue
    };
}

// Draw sprite on canvas
export function drawSprite(sprite, color) {
    if (typeof window === 'undefined') return null; // Server-side guard

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const centerX = 120;
    const centerY = 120;
    const baseSize = 80 * sprite.size;

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
    };
    const rgb = hexToRgb(color);
    const primaryColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((sprite.rotation * Math.PI) / 180);

    // Draw simple shape
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-20, -10, 8, 0, Math.PI * 2);
    ctx.arc(20, -10, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return canvas.toDataURL();
}

// Generates an avatar URL directly from a seed/name and color
export function generateAvatar(seed, color = '#A78BFA') {
    const sprite = generateProceduralSprite(seed);
    return drawSprite(sprite, color);
}
