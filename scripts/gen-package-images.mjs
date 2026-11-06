import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = "C:/Users/ofek8/OneDrive/Desktop/package-images";
mkdirSync(OUT, { recursive: true });

const FONT = "Arial, 'Segoe UI', sans-serif";

/** One square 1024x1024 package card. */
function card({ tier, price, businesses, features, accent, accent2, ribbon }) {
  const featRows = features
    .map(
      (f, i) => `
      <text x="512" y="${672 + i * 84}" font-family="${FONT}" font-size="36"
            fill="#3f3f46" text-anchor="middle" direction="rtl"><tspan fill="${accent}" font-weight="700">✔  </tspan>${f}</text>`,
    )
    .join("");

  const ribbonSvg = ribbon
    ? `<g transform="translate(512,112)">
         <rect x="-140" y="-30" width="280" height="56" rx="28" fill="rgba(255,255,255,0.22)" stroke="#ffffff" stroke-width="2"/>
         <text x="0" y="9" font-family="${FONT}" font-size="30" font-weight="700" fill="#fff" text-anchor="middle" direction="rtl">★ ${ribbon}</text>
       </g>`
    : "";

  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent2}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="#f4f4f5"/>
  <rect x="48" y="48" width="928" height="928" rx="40" fill="#ffffff" stroke="#e4e4e7" stroke-width="2"/>
  <path d="M48 88 a40 40 0 0 1 40 -40 h848 a40 40 0 0 1 40 40 v180 h-968 z" fill="url(#bg)"/>
  ${ribbonSvg}
  <text x="512" y="245" font-family="${FONT}" font-size="80" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2">${tier}</text>
  <text x="512" y="450" font-family="${FONT}" font-size="150" font-weight="800" fill="#18181b" text-anchor="middle">₪${price}</text>
  <text x="512" y="508" font-family="${FONT}" font-size="40" fill="#71717a" text-anchor="middle" direction="rtl">לחודש</text>
  <text x="512" y="592" font-family="${FONT}" font-size="46" font-weight="700" fill="${accent}" text-anchor="middle" direction="rtl">${businesses}</text>
  ${featRows}
  <text x="512" y="936" font-family="${FONT}" font-size="30" font-weight="600" fill="#a1a1aa" text-anchor="middle" direction="rtl">AI Business Builder</text>
</svg>`;
}

const cards = [
  {
    file: "basic.png",
    tier: "BASIC",
    price: "499",
    businesses: "עד עסק אחד",
    accent: "#4f46e5",
    accent2: "#818cf8",
    ribbon: "מומלץ",
    features: ["אתר מפורסם + קביעת תורים", "100 יצירות AI בחודש", "חנות, CRM והצעות מחיר"],
  },
  {
    file: "pro.png",
    tier: "PRO",
    price: "799",
    businesses: "עד 2 עסקים",
    accent: "#7c3aed",
    accent2: "#a78bfa",
    ribbon: null,
    features: ["כל מה שב-BASIC", "סוכן וואטסאפ + פרסום ממומן", "300 יצירות AI בחודש"],
  },
  {
    file: "business.png",
    tier: "Business",
    price: "999",
    businesses: "עד 3 עסקים",
    accent: "#b45309",
    accent2: "#f59e0b",
    ribbon: null,
    features: ["כל מה שב-PRO", "ציון עסקי + תובנות AI", "תמיכה מועדפת"],
  },
];

for (const c of cards) {
  const svg = card(c);
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, c.file));
  console.log("wrote", join(OUT, c.file));
}
console.log("DONE ->", OUT);
