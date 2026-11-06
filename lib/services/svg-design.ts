/**
 * Zero-cost visual assets: deterministic SVG hero backgrounds generated from
 * the brand palette, plus sanitization for AI-designed SVG logos.
 *
 * Everything here is a pure function of (brandHex, seed) — no randomness, no
 * network calls, no LLM. Same inputs always render the same pixels, but two
 * different businesses (different seeds) get visibly different compositions
 * because the seed picks a "layout variant" and nudges positions/sizes.
 */

/** Simple deterministic hash for picking a variant per business. */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  const n = (i: number) =>
    Math.min(255, Math.max(0, parseInt(m.slice(i, i + 2), 16) + amount));
  return `#${[n(0), n(2), n(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** hex -> {h,s,l} (0-360, 0-100, 0-100) */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = clamp01(s / 100);
  const lN = clamp01(l / 100);
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = lN - c / 2;
  const to255 = (v: number) => Math.round(clamp01(v + m) * 255);
  return `#${[to255(r1), to255(g1), to255(b1)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Derives a harmonious accent color by rotating hue + adjusting saturation/lightness. */
function harmonize(hex: string, hueShift: number, sDelta: number, lTarget: number): string {
  const { h, s } = hexToHsl(hex);
  return hslToHex(h + hueShift, clamp01((s + sDelta) / 100) * 100, lTarget);
}

/** Picks one of `count` deterministic variants from a seed (independent of other picks). */
function pickVariant(h: number, shift: number, count: number): number {
  return (h >>> shift) % count;
}

/**
 * Premium abstract hero background (1536x1024) from brand colors.
 * Layered translucent blobs + soft gradient + subtle geometric motif + film
 * grain — the "expensive SaaS" look. Deterministic per (brandHex, seed).
 */
export function buildHeroSvg(brandHex: string, seed: string): string {
  const h = hashSeed(seed);
  const dark = shade(brandHex, -70);
  const light = shade(brandHex, 60);
  // Complementary/analogous accent derived from the brand hue for richer depth.
  const accent = harmonize(brandHex, 28 + (h % 24), 6, 68);
  const accent2 = harmonize(brandHex, -(32 + ((h >> 4) % 20)), -4, 30);

  // Vary blob positions per business so every site feels unique.
  const x1 = 200 + (h % 400);
  const y1 = 150 + ((h >> 3) % 300);
  const x2 = 900 + ((h >> 6) % 400);
  const y2 = 500 + ((h >> 9) % 300);
  const x3 = 500 + ((h >> 12) % 600);

  const motif = pickVariant(h, 15, 3); // 0=rings, 1=triangles, 2=none (kept subtle)
  const gradAngle = pickVariant(h, 18, 4); // rotate the base gradient direction

  const gradCoords = [
    { x1: "0", y1: "0", x2: "1", y2: "1" },
    { x1: "1", y1: "0", x2: "0", y2: "1" },
    { x1: "0", y1: "1", x2: "1", y2: "0" },
    { x1: "0.5", y1: "0", x2: "0.5", y2: "1" },
  ][gradAngle];

  let motifShapes = "";
  if (motif === 0) {
    // Faint concentric rings — echoes a premium fintech/SaaS look.
    const rcx = 1180 + (h % 200);
    const rcy = 220 + ((h >> 7) % 160);
    motifShapes = [80, 150, 220].map(
      (r, i) =>
        `<circle cx="${rcx}" cy="${rcy}" r="${r}" fill="none" stroke="${accent}" stroke-opacity="${0.16 - i * 0.04}" stroke-width="1.5"/>`,
    ).join("");
  } else if (motif === 1) {
    // Faint triangular shards for an angular, editorial feel.
    const tx = 220 + ((h >> 10) % 260);
    const ty = 780 + ((h >> 2) % 120);
    motifShapes = `
      <polygon points="${tx},${ty} ${tx + 160},${ty - 90} ${tx + 260},${ty + 40}" fill="${accent}" opacity="0.08"/>
      <polygon points="${tx + 90},${ty + 70} ${tx + 230},${ty - 10} ${tx + 300},${ty + 120}" fill="${accent2}" opacity="0.07"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="${gradCoords.x1}" y1="${gradCoords.y1}" x2="${gradCoords.x2}" y2="${gradCoords.y2}">
      <stop offset="0%" stop-color="${dark}"/>
      <stop offset="45%" stop-color="${brandHex}"/>
      <stop offset="75%" stop-color="${accent2}"/>
      <stop offset="100%" stop-color="${shade(brandHex, -30)}"/>
    </linearGradient>
    <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${light}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${light}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow3" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.02 0"/>
    </filter>
  </defs>
  <rect width="1536" height="1024" fill="url(#bg)"/>
  <circle cx="${x1}" cy="${y1}" r="420" fill="url(#glow1)"/>
  <circle cx="${x2}" cy="${y2}" r="500" fill="url(#glow2)"/>
  <circle cx="${x3}" cy="120" r="300" fill="url(#glow1)" opacity="0.7"/>
  <circle cx="${(x1 + x3) / 2}" cy="${(y1 + y2) / 2}" r="360" fill="url(#glow3)" opacity="0.6"/>
  ${motifShapes}
  <path d="M0,760 C300,${680 + (h % 90)} 600,${840 - (h % 70)} 900,780 C1200,720 1400,800 1536,760 L1536,1024 L0,1024 Z"
        fill="#ffffff" opacity="0.07"/>
  <path d="M0,840 C400,${780 + ((h >> 4) % 60)} 800,${900 - ((h >> 5) % 60)} 1536,830 L1536,1024 L0,1024 Z"
        fill="#000000" opacity="0.10"/>
  <rect width="1536" height="1024" filter="url(#grain)" opacity="0.5"/>
</svg>`;
}

/**
 * Slim generative "art band" (1536x340) unique per business — layered brand
 * blobs, a flowing wave, and a seed-picked geometric motif (dot grid / mesh
 * lines / soft grid). Used as a decorative full-width divider on the
 * storefront so every site has a one-of-a-kind designed feel (zero cost).
 */
export function buildBandSvg(brandHex: string, seed: string): string {
  const h = hashSeed(seed);
  const dark = shade(brandHex, -60);
  const light = shade(brandHex, 70);
  const accent = harmonize(brandHex, 24 + (h % 30), 4, 72);
  const cx1 = 150 + (h % 1100);
  const cx2 = 300 + ((h >> 5) % 1000);
  const cx3 = 700 + ((h >> 9) % 700);
  const wy = 170 + (h % 70);

  const texture = pickVariant(h, 13, 3); // 0=dots, 1=diagonal mesh lines, 2=soft grid
  let texturePattern = "";
  if (texture === 0) {
    texturePattern = `
    <pattern id="bd" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="#ffffff" opacity="0.12"/>
    </pattern>`;
  } else if (texture === 1) {
    texturePattern = `
    <pattern id="bd" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="34" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>
    </pattern>`;
  } else {
    texturePattern = `
    <pattern id="bd" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"/>
    </pattern>`;
  }

  // A soft second color-wash so the band reads as more than a flat tint.
  const washAngle = pickVariant(h, 21, 2);
  const wash = washAngle === 0
    ? `<rect width="1536" height="340" fill="url(#wash)"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 340" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/>
      <stop offset="55%" stop-color="${brandHex}"/>
      <stop offset="100%" stop-color="${shade(brandHex, -25)}"/>
    </linearGradient>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.16"/>
      <stop offset="50%" stop-color="${accent}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.14"/>
    </linearGradient>
    <radialGradient id="bg1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${light}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${light}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bg2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bg3" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    ${texturePattern}
  </defs>
  <rect width="1536" height="340" fill="url(#bb)"/>
  ${wash}
  <rect width="1536" height="340" fill="url(#bd)"/>
  <circle cx="${cx1}" cy="70" r="240" fill="url(#bg1)"/>
  <circle cx="${cx2}" cy="300" r="280" fill="url(#bg2)"/>
  <circle cx="${cx3}" cy="110" r="180" fill="url(#bg1)" opacity="0.7"/>
  <circle cx="${(cx1 + cx2) / 2}" cy="180" r="150" fill="url(#bg3)" opacity="0.55"/>
  <path d="M0,${wy} C320,${wy - 60} 620,${wy + 70} 920,${wy} C1220,${wy - 60} 1400,${wy + 30} 1536,${wy - 20} L1536,340 L0,340 Z" fill="#ffffff" opacity="0.06"/>
</svg>`;
}

/** Fallback monogram logo when AI design fails (square icon only, no name). */
export function buildMonogramLogo(initial: string, brandHex: string): string {
  const dark = shade(brandHex, -50);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brandHex}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#g)"/>
  <text x="128" y="172" text-anchor="middle" font-family="Heebo, Arial, sans-serif"
        font-size="128" font-weight="800" fill="#ffffff">${initial}</text>
</svg>`;
}

/** Escapes text for safe embedding inside SVG <text> content. */
function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Fallback wide logo lockup when AI design fails: a rounded-square monogram
 * icon + the Hebrew business name + an optional smaller English line beneath.
 * viewBox 0 0 512 256 to match the premium AI lockups (symbol + wordmark).
 */
export function buildWordmarkLogo(
  nameHe: string,
  nameEn: string | null,
  brandHex: string,
): string {
  const dark = shade(brandHex, -50);
  const light = shade(brandHex, 35);
  const initial = escapeSvgText((nameHe || "?").trim().charAt(0) || "?");
  const heSafe = escapeSvgText((nameHe || "").trim().slice(0, 30));
  const enSafe = nameEn ? escapeSvgText(nameEn.trim().slice(0, 40).toUpperCase()) : "";

  // Icon square sits on the right edge (RTL-friendly); wordmark grows to its left.
  const iconSize = 168;
  const iconX = 512 - iconSize - 24;
  const iconY = (256 - iconSize) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="45%" stop-color="${brandHex}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="gh" cx="30%" cy="22%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="36" fill="url(#g)"/>
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="36" fill="url(#gh)"/>
  <text x="${iconX + iconSize / 2}" y="${iconY + iconSize / 2 + 30}" text-anchor="middle"
        font-family="Heebo, Arial, sans-serif" font-size="84" font-weight="800" fill="#ffffff">${initial}</text>
  <text x="${iconX - 24}" y="${enSafe ? 120 : 142}" text-anchor="end" direction="rtl"
        font-family="Heebo, Arial, sans-serif" font-size="46" font-weight="700" fill="${brandHex}">${heSafe}</text>
  ${enSafe ? `<text x="${iconX - 24}" y="164" text-anchor="end" font-family="Heebo, Arial, sans-serif" font-size="22" font-weight="500" letter-spacing="2" fill="${dark}">${enSafe}</text>` : ""}
</svg>`;
}

/* ------------------------------------------------------------------ *
 * Vector logo suite
 *
 * Three basic, clean logos drawn in code from the business name. The only
 * thing the model contributes is taste — palette, initials, a latin
 * transliteration, a shape and a motif (see lib/ai/agents/logo-design.ts) —
 * and taste is what a free text model is good at. Drawing is arithmetic, and
 * arithmetic is free, instant, always succeeds, renders crisp at any size,
 * and never mangles Hebrew the way an image model does.
 * ------------------------------------------------------------------ */

export type LogoShape = "circle" | "rounded" | "square" | "shield" | "none";

export type LogoMotif =
  | "spark"
  | "leaf"
  | "wave"
  | "diamond"
  | "arch"
  | "ring"
  | "bolt"
  | "heart"
  | "drop"
  | "peak";

export type LogoSpec = {
  /** The business name as customers know it (usually Hebrew). */
  name: string;
  /** Elegant latin rendering, used as the secondary line. Null to omit. */
  latin: string | null;
  /** 1-2 characters for the monogram. */
  initials: string;
  brandHex: string;
  accentHex: string;
  shape: LogoShape;
  motif: LogoMotif;
  /** 500-900. Heavier reads bolder/more modern, lighter reads more luxury. */
  weight: number;
  letterSpacing: number;
};

/**
 * The motif marks. Each is drawn inside a 100x100 box centred on (50,50) and
 * inherits `currentColor`, so the caller places and tints them. Deliberately
 * simple geometry: a mark that survives a 24px site header is worth more than
 * an intricate one that turns to mud.
 */
const MOTIF_PATHS: Record<LogoMotif, string> = {
  spark:
    '<path d="M50 12 L59 41 L88 50 L59 59 L50 88 L41 59 L12 50 L41 41 Z" fill="currentColor"/>',
  leaf:
    '<path d="M50 14 C74 30 82 54 66 74 C58 84 42 84 34 74 C18 54 26 30 50 14 Z" fill="currentColor"/><path d="M50 26 L50 82" stroke="currentColor" stroke-opacity=".35" stroke-width="4" stroke-linecap="round" fill="none"/>',
  wave:
    '<path d="M14 58 C26 40 38 40 50 58 C62 76 74 76 86 58" stroke="currentColor" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M14 36 C26 18 38 18 50 36 C62 54 74 54 86 36" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-opacity=".5" fill="none"/>',
  diamond: '<path d="M50 10 L90 50 L50 90 L10 50 Z" fill="currentColor"/>',
  arch:
    '<path d="M18 84 L18 50 A32 32 0 0 1 82 50 L82 84" stroke="currentColor" stroke-width="11" stroke-linecap="round" fill="none"/>',
  ring:
    '<circle cx="50" cy="50" r="32" stroke="currentColor" stroke-width="11" fill="none"/><circle cx="50" cy="50" r="9" fill="currentColor"/>',
  bolt: '<path d="M56 10 L26 56 L46 56 L44 90 L74 44 L54 44 Z" fill="currentColor"/>',
  heart:
    '<path d="M50 84 C18 62 14 42 26 30 C36 20 48 24 50 34 C52 24 64 20 74 30 C86 42 82 62 50 84 Z" fill="currentColor"/>',
  drop:
    '<path d="M50 12 C70 40 80 52 80 64 A30 30 0 0 1 20 64 C20 52 30 40 50 12 Z" fill="currentColor"/>',
  peak:
    '<path d="M50 16 L86 84 L14 84 Z" fill="currentColor"/><path d="M50 16 L68 50 L50 60 L32 50 Z" fill="#ffffff" fill-opacity=".35"/>',
};

/**
 * Shrinks the type until the name actually fits the space it was given.
 *
 * There is no text measurement in an SVG string — the renderer lays it out
 * later — so a fixed font-size means "צימרים בבית שמן" runs off the canvas
 * while "GRAVÉ" floats in whitespace. Estimating from the glyph count at
 * ~0.6em average advance is crude, but it is the difference between a lockup
 * that always fits and one that only fits short names.
 *
 * Latin capitals run ~0.72em in the Arial fallback an <img> actually renders
 * with (web fonts never load inside an SVG image), and letter-spacing adds a
 * fixed amount per gap — ignoring both is what cropped "GOLDEN MEMORY" to
 * "OLDEN MEMOR" in the header.
 */
export function fitFontSize(
  text: string,
  maxWidth: number,
  ideal: number,
  min = 22,
  letterSpacing = 0,
): number {
  const em = [...text].reduce((sum, ch) => sum + (/[A-Z0-9]/.test(ch) ? 0.72 : 0.6), 0);
  const spacing = Math.max(0, text.length - 1) * letterSpacing;
  if (em * ideal + spacing <= maxWidth) return ideal;
  return Math.max(min, Math.floor(((maxWidth - spacing) / em) * 10) / 10);
}

/**
 * Where to anchor text that must sit to the LEFT of a fixed x.
 *
 * SVG's text-anchor is relative to the inline direction, so for `direction=rtl`
 * "end" is the LEFT edge — meaning `text-anchor="end"` makes Hebrew grow
 * rightwards, straight over whatever the x was measured away from. RTL text
 * pinned on its right edge wants "start"; LTR text wants "end".
 */
const RTL_RIGHT_ALIGNED = 'text-anchor="start" direction="rtl"';

/** The badge the monogram/motif sits inside. */
function badge(x: number, y: number, size: number, shape: LogoShape, fill: string): string {
  if (shape === "none") return "";
  if (shape === "circle") {
    const r = size / 2;
    return `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="${fill}"/>`;
  }
  if (shape === "shield") {
    const s = size;
    return `<path d="M${x + s / 2} ${y} L${x + s} ${y + s * 0.22} L${x + s} ${y + s * 0.6} C${x + s} ${y + s * 0.84} ${x + s * 0.78} ${y + s} ${x + s / 2} ${y + s} C${x + s * 0.22} ${y + s} ${x} ${y + s * 0.84} ${x} ${y + s * 0.6} L${x} ${y + s * 0.22} Z" fill="${fill}"/>`;
  }
  const rx = shape === "square" ? 0 : size * 0.22;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}" fill="${fill}"/>`;
}

function logoDefs(brandHex: string, accentHex: string): string {
  return `<defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${shade(brandHex, 28)}"/>
      <stop offset="55%" stop-color="${brandHex}"/>
      <stop offset="100%" stop-color="${accentHex}"/>
    </linearGradient>
    <radialGradient id="lh" cx="30%" cy="22%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

function motifMark(motif: LogoMotif, x: number, y: number, size: number, color: string): string {
  const s = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${s})" color="${color}">${MOTIF_PATHS[motif]}</g>`;
}

/**
 * Concept 1 — symbol + wordmark. The badge sits on the RIGHT because the
 * lockup reads right-to-left, so the mark comes first to a Hebrew reader.
 */
function symbolLockup(spec: LogoSpec): string {
  const name = escapeSvgText(spec.name.trim().slice(0, 26));
  const latin = spec.latin ? escapeSvgText(spec.latin.trim().slice(0, 34).toUpperCase()) : "";
  const ink = shade(spec.brandHex, -60);
  const size = 152;
  const bx = 512 - size - 22;
  const by = (256 - size) / 2;
  // Everything left of the badge, minus the gutter, is what the name has.
  const textRight = bx - 26;
  const nameSize = fitFontSize(name, textRight - 16, 52, 22, spec.letterSpacing);
  const latinSize = latin ? fitFontSize(latin, textRight - 16, 21, 12, spec.letterSpacing + 3) : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256">
  ${logoDefs(spec.brandHex, spec.accentHex)}
  ${badge(bx, by, size, spec.shape, "url(#lg)")}
  ${spec.shape !== "none" ? badge(bx, by, size, spec.shape, "url(#lh)") : ""}
  ${motifMark(spec.motif, bx + size * 0.22, by + size * 0.22, size * 0.56, spec.shape === "none" ? spec.brandHex : "#ffffff")}
  <text x="${textRight}" y="${latin ? 122 : 146}" ${RTL_RIGHT_ALIGNED}
        font-family="Heebo, Arial, sans-serif" font-size="${nameSize}" font-weight="${spec.weight}"
        letter-spacing="${spec.letterSpacing}" fill="${ink}">${name}</text>
  ${latin ? `<text x="${textRight}" y="164" text-anchor="end" font-family="Heebo, Arial, sans-serif" font-size="${latinSize}" font-weight="500" letter-spacing="${spec.letterSpacing + 3}" fill="${spec.accentHex}">${latin}</text>` : ""}
</svg>`;
}

/** Concept 2 — a closed emblem: initials in a badge, name centred beneath. */
function monogramLockup(spec: LogoSpec): string {
  const name = escapeSvgText(spec.name.trim().slice(0, 26));
  const initials = escapeSvgText(spec.initials.trim().slice(0, 2) || spec.name.trim().charAt(0) || "?");
  const ink = shade(spec.brandHex, -60);
  const size = 118;
  const bx = (512 - size) / 2;
  const shape: LogoShape = spec.shape === "none" ? "circle" : spec.shape;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256">
  ${logoDefs(spec.brandHex, spec.accentHex)}
  ${badge(bx, 22, size, shape, "url(#lg)")}
  ${badge(bx, 22, size, shape, "url(#lh)")}
  <text x="256" y="${22 + size * 0.68}" text-anchor="middle" direction="rtl"
        font-family="Heebo, Arial, sans-serif" font-size="${initials.length > 1 ? 52 : 64}"
        font-weight="800" letter-spacing="1" fill="#ffffff">${initials}</text>
  <text x="256" y="196" text-anchor="middle" direction="rtl"
        font-family="Heebo, Arial, sans-serif" font-size="${fitFontSize(name, 460, 40, 18, spec.letterSpacing + 1)}" font-weight="${spec.weight}"
        letter-spacing="${spec.letterSpacing + 1}" fill="${ink}">${name}</text>
  <line x1="196" y1="216" x2="316" y2="216" stroke="${spec.accentHex}" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}

/** Concept 3 — pure typography: the name is the logo, with one accent rule. */
function wordmarkLockup(spec: LogoSpec): string {
  const name = escapeSvgText(spec.name.trim().slice(0, 26));
  const latin = spec.latin ? escapeSvgText(spec.latin.trim().slice(0, 34).toUpperCase()) : "";
  const ink = shade(spec.brandHex, -68);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256">
  ${logoDefs(spec.brandHex, spec.accentHex)}
  <text x="256" y="${latin ? 128 : 146}" text-anchor="middle" direction="rtl"
        font-family="Heebo, Arial, sans-serif" font-size="${fitFontSize(name, 470, 64, 24, spec.letterSpacing)}" font-weight="${spec.weight}"
        letter-spacing="${spec.letterSpacing}" fill="${ink}">${name}</text>
  <g transform="translate(256 ${latin ? 152 : 170})">
    <line x1="-118" y1="0" x2="-22" y2="0" stroke="${spec.accentHex}" stroke-width="3" stroke-linecap="round"/>
    ${motifMark(spec.motif, -14, -14, 28, spec.brandHex)}
    <line x1="22" y1="0" x2="118" y2="0" stroke="${spec.accentHex}" stroke-width="3" stroke-linecap="round"/>
  </g>
  ${latin ? `<text x="256" y="200" text-anchor="middle" font-family="Heebo, Arial, sans-serif" font-size="${fitFontSize(latin, 470, 22, 12, spec.letterSpacing + 5)}" font-weight="500" letter-spacing="${spec.letterSpacing + 5}" fill="${shade(spec.brandHex, -20)}">${latin}</text>` : ""}
</svg>`;
}

/** The three proposals an owner picks from. Order is stable. */
export function buildLogoSuite(spec: LogoSpec): { key: string; svg: string }[] {
  return [
    { key: "symbol", svg: symbolLockup(spec) },
    { key: "monogram", svg: monogramLockup(spec) },
    { key: "wordmark", svg: wordmarkLockup(spec) },
  ];
}

/**
 * The generated hero background, with the business name set into it.
 *
 * Same composition as buildHeroSvg — that gradient already looks good — plus a
 * large, widely-tracked wordmark. It is deliberately semi-transparent and
 * centred high: every hero style paints its own headline over this image, so
 * the name has to read as a brand layer behind the copy rather than compete
 * with it.
 */
export function buildBrandHeroSvg(
  brandHex: string,
  seed: string,
  name: string,
  latin?: string | null,
): string {
  const base = buildHeroSvg(brandHex, seed);
  const label = escapeSvgText((name || "").trim().slice(0, 28));
  if (!label) return base;
  const sub = latin ? escapeSvgText(latin.trim().slice(0, 40).toUpperCase()) : "";

  const overlay = `
  <text x="768" y="500" text-anchor="middle" direction="rtl"
        font-family="Heebo, Arial, sans-serif" font-size="${fitFontSize(label, 1280, 150, 54, 4)}" font-weight="800"
        letter-spacing="4" fill="#ffffff" fill-opacity="0.9">${label}</text>
  ${sub ? `<text x="768" y="576" text-anchor="middle" font-family="Heebo, Arial, sans-serif" font-size="42" font-weight="400" letter-spacing="16" fill="#ffffff" fill-opacity="0.6">${sub}</text>` : ""}
  <line x1="618" y1="${sub ? 622 : 552}" x2="918" y2="${sub ? 622 : 552}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;

  // Sits above the artwork but below the grain, so the name picks up the same
  // film texture as the rest of the composition instead of floating on top.
  return base.replace(
    '<rect width="1536" height="1024" filter="url(#grain)" opacity="0.5"/>',
    `${overlay}\n  <rect width="1536" height="1024" filter="url(#grain)" opacity="0.5"/>`,
  );
}

/**
 * Validates an AI-generated SVG: must be a plain vector with no scripts,
 * event handlers, filters, embedded raster images, or external references.
 * <text>/<tspan> are allowed (logos include the business name as a wordmark),
 * and so are <defs>/gradients (premium lockups use richer fills). Returns
 * null if unsafe/invalid.
 */
export function sanitizeSvg(raw: string): string | null {
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start === -1 || end === -1) return null;
  const svg = raw.slice(start, end + 6);

  const lowered = svg.toLowerCase();
  const forbidden = [
    "<script",
    "javascript:",
    "onload",
    "onclick",
    "onerror",
    "<foreignobject",
    "<filter",
    "<image",
    "href=\"http",
    "href='http",
    "xlink:href=\"http",
  ];
  if (forbidden.some((f) => lowered.includes(f))) return null;
  if (svg.length > 60000) return null;

  return svg;
}
