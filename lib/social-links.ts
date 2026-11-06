import {
  siFacebook,
  siInstagram,
  siTiktok,
  siYoutube,
  siX,
  siTelegram,
  siPinterest,
  siWhatsapp,
  siWaze,
  siGooglemaps,
  siSnapchat,
} from "simple-icons";

/**
 * Storefront social-network links — pure, shared client/server.
 * Stored on websites.social_links as:
 *   [{ platform: "instagram", url: "https://…", enabled: true }, …]
 * Only enabled entries with a valid https URL render on the public site.
 */

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "whatsapp"
  | "youtube"
  | "linkedin"
  | "x"
  | "telegram"
  | "pinterest"
  | "snapchat"
  | "waze"
  | "googlemaps";

export type SocialLink = {
  platform: SocialPlatform;
  url: string;
  enabled: boolean;
};

// LinkedIn was removed from simple-icons (brand-guidelines request) — the
// classic "in" glyph is inlined instead.
const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z";

export type SocialPlatformDef = {
  key: SocialPlatform;
  label: string;
  /** Official brand color (hex, with #). */
  color: string;
  /** 24x24 viewBox SVG path (fill = currentColor). */
  path: string;
  placeholder: string;
};

export const SOCIAL_PLATFORMS: SocialPlatformDef[] = [
  { key: "instagram", label: "אינסטגרם", color: "#E4405F", path: siInstagram.path, placeholder: "https://instagram.com/yourname" },
  { key: "facebook", label: "פייסבוק", color: `#${siFacebook.hex}`, path: siFacebook.path, placeholder: "https://facebook.com/yourpage" },
  { key: "tiktok", label: "טיקטוק", color: "#010101", path: siTiktok.path, placeholder: "https://tiktok.com/@yourname" },
  { key: "whatsapp", label: "וואטסאפ", color: `#${siWhatsapp.hex}`, path: siWhatsapp.path, placeholder: "https://wa.me/9725..." },
  { key: "youtube", label: "יוטיוב", color: `#${siYoutube.hex}`, path: siYoutube.path, placeholder: "https://youtube.com/@yourchannel" },
  { key: "linkedin", label: "לינקדאין", color: "#0A66C2", path: LINKEDIN_PATH, placeholder: "https://linkedin.com/company/yourbiz" },
  { key: "x", label: "X (טוויטר)", color: "#0F1419", path: siX.path, placeholder: "https://x.com/yourname" },
  { key: "telegram", label: "טלגרם", color: `#${siTelegram.hex}`, path: siTelegram.path, placeholder: "https://t.me/yourchannel" },
  { key: "pinterest", label: "פינטרסט", color: `#${siPinterest.hex}`, path: siPinterest.path, placeholder: "https://pinterest.com/yourname" },
  { key: "snapchat", label: "סנאפצ'ט", color: "#F7C600", path: siSnapchat.path, placeholder: "https://snapchat.com/add/yourname" },
  { key: "waze", label: "Waze — ניווט", color: "#05C8F7", path: siWaze.path, placeholder: "https://waze.com/ul?q=..." },
  { key: "googlemaps", label: "Google Maps", color: `#${siGooglemaps.hex}`, path: siGooglemaps.path, placeholder: "https://maps.app.goo.gl/..." },
];

const PLATFORM_KEYS = new Set(SOCIAL_PLATFORMS.map((p) => p.key));

export function platformDef(key: string): SocialPlatformDef | undefined {
  return SOCIAL_PLATFORMS.find((p) => p.key === key);
}

function validUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length < 12 || trimmed.length > 300) return false;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

/** Parses the stored jsonb into a clean, deduped SocialLink[] (bad rows dropped). */
export function parseSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: SocialLink[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const { platform, url, enabled } = row as Record<string, unknown>;
    if (typeof platform !== "string" || !PLATFORM_KEYS.has(platform as SocialPlatform)) continue;
    if (seen.has(platform)) continue;
    if (typeof url !== "string" || !url.trim()) continue;
    seen.add(platform);
    out.push({
      platform: platform as SocialPlatform,
      url: url.trim().slice(0, 300),
      enabled: enabled === true && validUrl(url),
    });
  }
  return out;
}

/** The links that should actually render on the public storefront. */
export function publicSocialLinks(value: unknown): SocialLink[] {
  return parseSocialLinks(value).filter((l) => l.enabled && validUrl(l.url));
}
