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

    const blink = rand() < 0.12;
    const sleepy = !blink && rand() < 0.18;
    const mouthType = Math.floor(rand() * 4);

    const mouthY = faceY + w * 0.08;
    const mouthW = w * (0.11 + rand() * 0.03);
    const mouthH = w * (0.06 + rand() * 0.02);

    let mouth = "";
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

    const eyes = blink
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

    const blushY = faceY + w * 0.03;
    const blushX = w * 0.17;
    const blushR = w * 0.035;

    const sparkle = rand() < 0.22;
    const sparkleEls = sparkle
        ? `
      <g opacity="0.9">
        <path d="M ${(w * 0.18).toFixed(2)} ${(hgt * 0.22).toFixed(2)} l ${(w * 0.018).toFixed(2)} ${(w * 0.05).toFixed(2)} l ${(w * 0.05).toFixed(2)} ${(w * 0.018).toFixed(2)} l ${(-w * 0.05).toFixed(2)} ${(w * 0.018).toFixed(2)} z" fill="rgba(255,255,255,0.55)"/>
        <path d="M ${(w * 0.78).toFixed(2)} ${(hgt * 0.26).toFixed(2)} l ${(w * 0.014).toFixed(2)} ${(w * 0.038).toFixed(2)} l ${(w * 0.038).toFixed(2)} ${(w * 0.014).toFixed(2)} l ${(-w * 0.038).toFixed(2)} ${(w * 0.014).toFixed(2)} z" fill="rgba(255,255,255,0.45)"/>
        <circle cx="${(w * 0.24).toFixed(2)}" cy="${(hgt * 0.74).toFixed(2)}" r="${(w * 0.012).toFixed(2)}" fill="rgba(255,255,255,0.35)"/>
      </g>
    `
        : "";

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bgA}"/>
      <stop offset="1" stop-color="${bgB}"/>
    </linearGradient>
    <radialGradient id="body" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="${body}"/>
      <stop offset="1" stop-color="${body2}"/>
    </radialGradient>
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
  </defs>

  <rect x="0" y="0" width="${w}" height="${hgt}" rx="${(w * 0.18).toFixed(2)}" fill="url(#bg)"/>
  ${sparkleEls}

  <g filter="url(#softShadow)">
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
</svg>`;

    return new NextResponse(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
