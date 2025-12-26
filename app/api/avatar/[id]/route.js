import { NextResponse } from "next/server";

export const runtime = "edge";

function fnv1a32(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100);
  l = clamp(l, 0, 100);
  return `hsl(${h} ${s}% ${l}%)`;
}

function blobPath(rand, cx, cy, r, points = 12) {
  const pts = [];
  const wobble = 0.22 + rand() * 0.18;

  for (let i = 0; i < points; i++) {
    const a = (Math.PI * 2 * i) / points;
    const k = 1 + (rand() * 2 - 1) * wobble;
    const rr = r * k;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }

  const mids = [];
  for (let i = 0; i < points; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % points];
    mids.push({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 });
  }

  let d = `M ${mids[0].x.toFixed(2)} ${mids[0].y.toFixed(2)}`;
  for (let i = 0; i < points; i++) {
    const p = pts[(i + 1) % points];
    const m = mids[(i + 1) % points];
    d += ` Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`;
  }
  d += " Z";
  return d;
}

// Determine rarity tier based on RNG
function getRarity(rand) {
  const roll = rand();
  if (roll < 0.005) return 'legendary';  // 0.5%
  if (roll < 0.03) return 'epic';         // 2.5%
  if (roll < 0.10) return 'rare';         // 7%
  if (roll < 0.30) return 'uncommon';     // 20%
  return 'common';                         // 70%
}

// Special face expressions for different rarities
function getSpecialFace(rarity, rand, w, cx, eyeY, eyeR, leftEyeX, rightEyeX, eye, shine, mouthY) {
  // Legendary: Heart eyes with star mouth
  if (rarity === 'legendary') {
    const heartSize = eyeR * 2.5;
    return {
      eyes: `
        <g fill="#FF69B4">
          <path d="M ${leftEyeX} ${eyeY - heartSize * 0.3} 
            c ${-heartSize * 0.5} ${-heartSize * 0.5} ${-heartSize * 1.2} ${heartSize * 0.3} 0 ${heartSize}
            c ${heartSize * 1.2} ${-heartSize * 0.7} ${heartSize * 0.5} ${-heartSize * 1.5} 0 ${-heartSize}z">
            <animate attributeName="fill" values="#FF69B4;#FF1493;#FF69B4" dur="1.5s" repeatCount="indefinite"/>
          </path>
          <path d="M ${rightEyeX} ${eyeY - heartSize * 0.3} 
            c ${-heartSize * 0.5} ${-heartSize * 0.5} ${-heartSize * 1.2} ${heartSize * 0.3} 0 ${heartSize}
            c ${heartSize * 1.2} ${-heartSize * 0.7} ${heartSize * 0.5} ${-heartSize * 1.5} 0 ${-heartSize}z">
            <animate attributeName="fill" values="#FF69B4;#FF1493;#FF69B4" dur="1.5s" repeatCount="indefinite"/>
          </path>
        </g>
      `,
      mouth: `<text x="${cx}" y="${mouthY + w * 0.03}" font-size="${w * 0.08}" text-anchor="middle" fill="${eye}">★</text>`
    };
  }

  // Epic: Star eyes
  if (rarity === 'epic') {
    const starR = eyeR * 1.8;
    const starPath = (cx, cy) => {
      let p = '';
      for (let i = 0; i < 5; i++) {
        const angle1 = (Math.PI * 2 * i / 5) - Math.PI / 2;
        const angle2 = angle1 + Math.PI / 5;
        const x1 = cx + Math.cos(angle1) * starR;
        const y1 = cy + Math.sin(angle1) * starR;
        const x2 = cx + Math.cos(angle2) * starR * 0.4;
        const y2 = cy + Math.sin(angle2) * starR * 0.4;
        p += `${i === 0 ? 'M' : 'L'} ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} `;
      }
      return p + 'Z';
    };
    return {
      eyes: `
        <g fill="#FFD700">
          <path d="${starPath(leftEyeX, eyeY)}">
            <animateTransform attributeName="transform" type="rotate" from="0 ${leftEyeX} ${eyeY}" to="360 ${leftEyeX} ${eyeY}" dur="4s" repeatCount="indefinite"/>
          </path>
          <path d="${starPath(rightEyeX, eyeY)}">
            <animateTransform attributeName="transform" type="rotate" from="0 ${rightEyeX} ${eyeY}" to="360 ${rightEyeX} ${eyeY}" dur="4s" repeatCount="indefinite"/>
          </path>
        </g>
      `,
      mouth: null
    };
  }

  // Rare: Sunglasses
  if (rarity === 'rare') {
    const glassW = w * 0.12;
    const glassH = w * 0.06;
    const bridgeY = eyeY;
    return {
      eyes: `
        <g>
          <rect x="${leftEyeX - glassW / 2}" y="${bridgeY - glassH / 2}" width="${glassW}" height="${glassH}" rx="${glassH * 0.2}" fill="#1a1a1a"/>
          <rect x="${rightEyeX - glassW / 2}" y="${bridgeY - glassH / 2}" width="${glassW}" height="${glassH}" rx="${glassH * 0.2}" fill="#1a1a1a"/>
          <path d="M ${leftEyeX + glassW / 2} ${bridgeY} L ${rightEyeX - glassW / 2} ${bridgeY}" stroke="#1a1a1a" stroke-width="${w * 0.012}"/>
          <line x1="${leftEyeX - glassW / 2}" y1="${bridgeY}" x2="${leftEyeX - glassW}" y2="${bridgeY - glassH * 0.3}" stroke="#1a1a1a" stroke-width="${w * 0.01}"/>
          <line x1="${rightEyeX + glassW / 2}" y1="${bridgeY}" x2="${rightEyeX + glassW}" y2="${bridgeY - glassH * 0.3}" stroke="#1a1a1a" stroke-width="${w * 0.01}"/>
          <!-- Lens shine -->
          <rect x="${leftEyeX - glassW / 2 + glassW * 0.1}" y="${bridgeY - glassH / 2 + glassH * 0.15}" width="${glassW * 0.3}" height="${glassH * 0.3}" fill="rgba(255,255,255,0.3)" rx="${glassH * 0.1}"/>
          <rect x="${rightEyeX - glassW / 2 + glassW * 0.1}" y="${bridgeY - glassH / 2 + glassH * 0.15}" width="${glassW * 0.3}" height="${glassH * 0.3}" fill="rgba(255,255,255,0.3)" rx="${glassH * 0.1}"/>
        </g>
      `,
      mouth: null
    };
  }

  return null;
}

// Generate sparkle/particle effects based on rarity
function getParticles(rarity, rand, w, hgt) {
  let particles = '';

  if (rarity === 'legendary') {
    // Rainbow rotating particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const dist = w * 0.42;
      const x = w / 2 + Math.cos(angle) * dist;
      const y = hgt / 2 + Math.sin(angle) * dist;
      const hue = (i * 45) % 360;
      const size = w * 0.025;
      particles += `
        <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${size.toFixed(2)}" fill="hsl(${hue} 100% 70%)">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="${1 + rand() * 0.5}s" repeatCount="indefinite"/>
          <animate attributeName="r" values="${size};${size * 1.5};${size}" dur="${1.5 + rand() * 0.5}s" repeatCount="indefinite"/>
        </circle>
      `;
    }
    // Floating sparkle star
    particles += `
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="2s" repeatCount="indefinite"/>
        <text x="${w * 0.15}" y="${hgt * 0.2}" font-size="${w * 0.06}" fill="#FFD700">✨</text>
        <text x="${w * 0.82}" y="${hgt * 0.25}" font-size="${w * 0.05}" fill="#FFD700">✨</text>
        <text x="${w * 0.2}" y="${hgt * 0.78}" font-size="${w * 0.04}" fill="#FFD700">✨</text>
        <text x="${w * 0.85}" y="${hgt * 0.8}" font-size="${w * 0.045}" fill="#FFD700">✨</text>
      </g>
    `;
  } else if (rarity === 'epic') {
    // Pulsing glow particles
    for (let i = 0; i < 5; i++) {
      const x = w * (0.1 + rand() * 0.8);
      const y = hgt * (0.1 + rand() * 0.8);
      const size = w * (0.015 + rand() * 0.02);
      particles += `
        <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${size.toFixed(2)}" fill="rgba(255,215,0,0.8)">
          <animate attributeName="opacity" values="0.2;0.9;0.2" dur="${1.5 + rand()}s" repeatCount="indefinite"/>
        </circle>
      `;
    }
    // Star accents
    particles += `
      <text x="${w * 0.12}" y="${hgt * 0.18}" font-size="${w * 0.05}" fill="#FFD700" opacity="0.8">⭐</text>
      <text x="${w * 0.85}" y="${hgt * 0.22}" font-size="${w * 0.04}" fill="#FFD700" opacity="0.7">⭐</text>
    `;
  } else if (rarity === 'rare') {
    // Cool sparkle accents
    particles += `
      <g opacity="0.9">
        <path d="M ${(w * 0.15).toFixed(2)} ${(hgt * 0.2).toFixed(2)} l ${(w * 0.02).toFixed(2)} ${(w * 0.06).toFixed(2)} l ${(w * 0.06).toFixed(2)} ${(w * 0.02).toFixed(2)} l ${(-w * 0.06).toFixed(2)} ${(w * 0.02).toFixed(2)} z" fill="rgba(255,255,255,0.7)">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite"/>
        </path>
        <path d="M ${(w * 0.82).toFixed(2)} ${(hgt * 0.24).toFixed(2)} l ${(w * 0.015).toFixed(2)} ${(w * 0.04).toFixed(2)} l ${(w * 0.04).toFixed(2)} ${(w * 0.015).toFixed(2)} l ${(-w * 0.04).toFixed(2)} ${(w * 0.015).toFixed(2)} z" fill="rgba(255,255,255,0.6)">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1.2s" repeatCount="indefinite"/>
        </path>
      </g>
    `;
  } else if (rarity === 'uncommon') {
    // Subtle shimmer
    particles += `
      <circle cx="${(w * 0.2).toFixed(2)}" cy="${(hgt * 0.22).toFixed(2)}" r="${(w * 0.012).toFixed(2)}" fill="rgba(255,255,255,0.5)">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${(w * 0.78).toFixed(2)}" cy="${(hgt * 0.25).toFixed(2)}" r="${(w * 0.01).toFixed(2)}" fill="rgba(255,255,255,0.4)">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.8s" repeatCount="indefinite"/>
      </circle>
    `;
  }

  return particles;
}

// Get special gradient for rarity
function getRarityGradient(rarity, hue, w) {
  if (rarity === 'legendary') {
    return `
      <linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(0 90% 65%)">
          <animate attributeName="stop-color" values="hsl(0 90% 65%);hsl(60 90% 65%);hsl(120 90% 65%);hsl(180 90% 65%);hsl(240 90% 65%);hsl(300 90% 65%);hsl(360 90% 65%)" dur="3s" repeatCount="indefinite"/>
        </stop>
        <stop offset="50%" stop-color="hsl(180 90% 65%)">
          <animate attributeName="stop-color" values="hsl(180 90% 65%);hsl(240 90% 65%);hsl(300 90% 65%);hsl(360 90% 65%);hsl(60 90% 65%);hsl(120 90% 65%);hsl(180 90% 65%)" dur="3s" repeatCount="indefinite"/>
        </stop>
        <stop offset="100%" stop-color="hsl(300 90% 65%)">
          <animate attributeName="stop-color" values="hsl(300 90% 65%);hsl(360 90% 65%);hsl(60 90% 65%);hsl(120 90% 65%);hsl(180 90% 65%);hsl(240 90% 65%);hsl(300 90% 65%)" dur="3s" repeatCount="indefinite"/>
        </stop>
      </linearGradient>
    `;
  }
  if (rarity === 'epic') {
    return `
      <linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue} 100% 70%)"/>
        <stop offset="50%" stop-color="hsl(${(hue + 40) % 360} 90% 60%)"/>
        <stop offset="100%" stop-color="hsl(${(hue + 80) % 360} 100% 70%)"/>
      </linearGradient>
    `;
  }
  return null;
}

// Get glow filter for rarity
function getRarityGlow(rarity, hue, w) {
  if (rarity === 'legendary') {
    return `
      <filter id="legendaryGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${w * 0.04}" result="blur"/>
        <feFlood flood-color="hsl(${hue} 100% 70%)" result="color">
          <animate attributeName="flood-color" values="hsl(0 100% 70%);hsl(120 100% 70%);hsl(240 100% 70%);hsl(360 100% 70%)" dur="2s" repeatCount="indefinite"/>
        </feFlood>
        <feComposite in="color" in2="blur" operator="in" result="glow"/>
        <feMerge>
          <feMergeNode in="glow"/>
          <feMergeNode in="glow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
  }
  if (rarity === 'epic') {
    return `
      <filter id="epicGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="${w * 0.025}" result="blur"/>
        <feFlood flood-color="hsl(${hue} 100% 75%)" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="glow"/>
        <feMerge>
          <feMergeNode in="glow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
  }
  return '';
}

export async function GET(req, { params }) {
  const { id } = await params;
  const url = new URL(req.url);

  const v = url.searchParams.get("v") ?? "";
  const key = `${id}:${v}`;

  const seed = fnv1a32(key);
  const rand = mulberry32(seed);

  const size = clamp(parseInt(url.searchParams.get("s") ?? "256", 10) || 256, 64, 1024);
  const w = size;
  const hgt = size;

  // Determine rarity FIRST (uses first random call)
  const rarity = getRarity(rand);

  const hue = Math.floor(rand() * 360);
  const hue2 = (hue + 25 + Math.floor(rand() * 80)) % 360;

  const bgA = hsl(hue, 80, 60);
  const bgB = hsl(hue2, 85, 55);

  const bodyHue = (hue + 10 + Math.floor(rand() * 40)) % 360;
  const body = hsl(bodyHue, 80, 62);
  const body2 = hsl((bodyHue + 18) % 360, 85, 55);
  const outline = hsl(bodyHue, 55, 28);

  const cheekHue = (bodyHue + 330) % 360;
  const cheek = hsl(cheekHue, 90, 70);

  const eye = hsl((bodyHue + 200) % 360, 25, 14);
  const shine = "rgba(255,255,255,0.85)";

  const cx = w / 2;
  const cy = hgt / 2 + w * 0.02;
  const r = w * (0.34 + rand() * 0.05);

  const blob = blobPath(rand, cx, cy, r, 12);

  const faceY = cy - w * 0.02;
  const eyeY = faceY - w * 0.03;
  const eyeSep = w * (0.13 + rand() * 0.03);
  const eyeR = w * (0.032 + rand() * 0.006);

  const leftEyeX = cx - eyeSep;
  const rightEyeX = cx + eyeSep;

  const mouthY = faceY + w * 0.08;
  const mouthW = w * (0.11 + rand() * 0.03);
  const mouthH = w * (0.06 + rand() * 0.02);

  // Check for special face based on rarity
  const specialFace = getSpecialFace(rarity, rand, w, cx, eyeY, eyeR, leftEyeX, rightEyeX, eye, shine, mouthY);

  let eyes, mouth;

  if (specialFace) {
    eyes = specialFace.eyes;
    mouth = specialFace.mouth;
  }

  // Default eyes/mouth if no special face or partial override
  if (!eyes) {
    const blink = rand() < 0.12;
    const sleepy = !blink && rand() < 0.18;

    eyes = blink
      ? `
        <path d="M ${(leftEyeX - eyeR * 1.2).toFixed(2)} ${eyeY.toFixed(2)} Q ${leftEyeX.toFixed(2)} ${(eyeY + eyeR * 0.3).toFixed(2)} ${(leftEyeX + eyeR * 1.2).toFixed(2)} ${eyeY.toFixed(2)}" stroke="${eye}" stroke-width="${(w * 0.018).toFixed(2)}" stroke-linecap="round" fill="none"/>
        <path d="M ${(rightEyeX - eyeR * 1.2).toFixed(2)} ${eyeY.toFixed(2)} Q ${rightEyeX.toFixed(2)} ${(eyeY + eyeR * 0.3).toFixed(2)} ${(rightEyeX + eyeR * 1.2).toFixed(2)} ${eyeY.toFixed(2)}" stroke="${eye}" stroke-width="${(w * 0.018).toFixed(2)}" stroke-linecap="round" fill="none"/>
      `
      : sleepy
        ? `
          <path d="M ${(leftEyeX - eyeR * 1.2).toFixed(2)} ${(eyeY - eyeR * 0.15).toFixed(2)} Q ${leftEyeX.toFixed(2)} ${(eyeY + eyeR * 0.55).toFixed(2)} ${(leftEyeX + eyeR * 1.2).toFixed(2)} ${(eyeY - eyeR * 0.15).toFixed(2)}" stroke="${eye}" stroke-width="${(w * 0.016).toFixed(2)}" stroke-linecap="round" fill="none" opacity="0.95"/>
          <path d="M ${(rightEyeX - eyeR * 1.2).toFixed(2)} ${(eyeY - eyeR * 0.15).toFixed(2)} Q ${rightEyeX.toFixed(2)} ${(eyeY + eyeR * 0.55).toFixed(2)} ${(rightEyeX + eyeR * 1.2).toFixed(2)} ${(eyeY - eyeR * 0.15).toFixed(2)}" stroke="${eye}" stroke-width="${(w * 0.016).toFixed(2)}" stroke-linecap="round" fill="none" opacity="0.95"/>
        `
        : `
          <circle cx="${leftEyeX.toFixed(2)}" cy="${eyeY.toFixed(2)}" r="${eyeR.toFixed(2)}" fill="${eye}"/>
          <circle cx="${rightEyeX.toFixed(2)}" cy="${eyeY.toFixed(2)}" r="${eyeR.toFixed(2)}" fill="${eye}"/>
          <circle cx="${(leftEyeX - eyeR * 0.25).toFixed(2)}" cy="${(eyeY - eyeR * 0.25).toFixed(2)}" r="${(eyeR * 0.32).toFixed(2)}" fill="${shine}"/>
          <circle cx="${(rightEyeX - eyeR * 0.25).toFixed(2)}" cy="${(eyeY - eyeR * 0.25).toFixed(2)}" r="${(eyeR * 0.32).toFixed(2)}" fill="${shine}"/>
        `;
  }

  if (!mouth) {
    const mouthType = Math.floor(rand() * 4);
    if (mouthType === 0) {
      const x0 = cx - mouthW / 2;
      const x1 = cx + mouthW / 2;
      const y0 = mouthY;
      const y1 = mouthY + mouthH;
      mouth = `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} Q ${cx.toFixed(2)} ${y1.toFixed(2)} ${x1.toFixed(2)} ${y0.toFixed(2)}" stroke="${eye}" stroke-width="${(w * 0.018).toFixed(2)}" stroke-linecap="round" fill="none"/>`;
    } else if (mouthType === 1) {
      const x0 = cx - mouthW / 2;
      const x1 = cx + mouthW / 2;
      const y0 = mouthY + mouthH * 0.25;
      mouth = `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} Q ${cx.toFixed(2)} ${(mouthY - mouthH * 0.05).toFixed(2)} ${x1.toFixed(2)} ${y0.toFixed(2)}" stroke="${eye}" stroke-width="${(w * 0.018).toFixed(2)}" stroke-linecap="round" fill="none"/>`;
    } else if (mouthType === 2) {
      const rr = w * 0.025;
      mouth = `<circle cx="${cx.toFixed(2)}" cy="${mouthY.toFixed(2)}" r="${rr.toFixed(2)}" fill="${eye}" opacity="0.9"/>`;
    } else {
      const x0 = cx - mouthW / 2;
      const x1 = cx + mouthW / 2;
      const y0 = mouthY;
      const y1 = mouthY + mouthH * 0.6;
      mouth = `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} Q ${cx.toFixed(2)} ${y1.toFixed(2)} ${x1.toFixed(2)} ${y0.toFixed(2)} Q ${cx.toFixed(2)} ${(y0 + mouthH * 0.25).toFixed(2)} ${x0.toFixed(2)} ${y0.toFixed(2)}" fill="${eye}" opacity="0.9"/>`;
    }
  }

  const blushY = faceY + w * 0.03;
  const blushX = w * 0.17;
  const blushR = w * 0.035;

  // Get rarity-specific elements
  const particles = getParticles(rarity, rand, w, hgt);
  const specialGradient = getRarityGradient(rarity, bodyHue, w);
  const glowFilter = getRarityGlow(rarity, bodyHue, w);

  // Determine which filter to use on body
  const bodyFilter = rarity === 'legendary' ? 'url(#legendaryGlow)' : rarity === 'epic' ? 'url(#epicGlow)' : 'url(#softShadow)';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">
  <defs>
    ${specialGradient || `
    <radialGradient id="body" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="${body}"/>
      <stop offset="1" stop-color="${body2}"/>
    </radialGradient>
    `}
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${(w * 0.02).toFixed(2)}" stdDeviation="${(w * 0.03).toFixed(2)}" flood-color="rgba(0,0,0,0.25)"/>
    </filter>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${(w * 0.01).toFixed(2)}" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    ${glowFilter}
  </defs>

  ${particles}

  <g filter="${bodyFilter}">
    <path d="${blob}" fill="url(#body)" stroke="${outline}" stroke-width="${(w * 0.018).toFixed(2)}" stroke-linejoin="round"/>
  </g>

  <g filter="url(#softGlow)">
    <circle cx="${(cx - blushX).toFixed(2)}" cy="${blushY.toFixed(2)}" r="${blushR.toFixed(2)}" fill="${cheek}" opacity="0.35"/>
    <circle cx="${(cx + blushX).toFixed(2)}" cy="${blushY.toFixed(2)}" r="${blushR.toFixed(2)}" fill="${cheek}" opacity="0.35"/>
    ${eyes}
    ${mouth}
  </g>

  <g opacity="0.15">
    <path d="${blob}" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="${(w * 0.01).toFixed(2)}"/>
  </g>
  
  ${rarity !== 'common' ? `
  <!-- Rarity indicator -->
  <text x="${w * 0.5}" y="${hgt * 0.95}" font-size="${w * 0.04}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui">${rarity.toUpperCase()}</text>
  ` : ''}
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
