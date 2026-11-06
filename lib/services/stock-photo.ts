/**
 * Free real-photo search. Zero setup by default: uses Openverse (no API key,
 * Creative-Commons commercial-licensed photos). If a free PEXELS_API_KEY is set,
 * it's used first for higher-quality results. No paid image generation involved.
 */

export type StockPhoto = {
  imageUrl: string;
  credit: string;
  source: "pexels" | "openverse";
};

export type StockPhotoCandidate = {
  imageUrl: string;
  thumbUrl: string;
  credit: string;
  source: "pexels" | "openverse";
};

async function searchPexelsMany(query: string, key: string, count: number): Promise<StockPhotoCandidate[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const photos: unknown[] = Array.isArray(data?.photos) ? data.photos : [];
  const out: StockPhotoCandidate[] = [];
  for (const raw of photos) {
    const p = raw as {
      src?: { large2x?: string; large?: string; original?: string; medium?: string };
      photographer?: string;
    };
    const url = p?.src?.large2x ?? p?.src?.large ?? p?.src?.original;
    const thumb = p?.src?.medium ?? url;
    if (!url || !thumb) continue;
    out.push({
      imageUrl: url,
      thumbUrl: thumb,
      credit: `צילום: ${p.photographer ?? "Pexels"} (Pexels)`,
      source: "pexels",
    });
  }
  return out;
}

async function searchOpenverseMany(
  query: string,
  count: number,
  license: string,
): Promise<StockPhotoCandidate[]> {
  const res = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=${encodeURIComponent(license)}&page_size=${count}&mature=false`,
    { headers: { "User-Agent": "AIBusinessBuilder/1.0 (stock-photo)" } },
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const results: unknown[] = Array.isArray(data?.results) ? data.results : [];
  const out: StockPhotoCandidate[] = [];
  for (const raw of results) {
    const r = raw as { url?: string; thumbnail?: string; title?: string; creator?: string };
    if (!r?.url) continue;
    const credit = r.creator ? `${r.title ?? "תמונה"} מאת ${r.creator} (Openverse)` : "Openverse";
    out.push({
      imageUrl: r.url,
      thumbUrl: r.thumbnail ?? r.url,
      credit,
      source: "openverse",
    });
  }
  return out;
}

/**
 * Searches up to `count` free stock photo candidates for the user to choose
 * from: Pexels first (if PEXELS_API_KEY set), otherwise Openverse. Openverse
 * tries true no-rights-reserved licenses (CC0 / Public Domain Mark) first,
 * and only falls back to broader commercial-safe licenses if there aren't
 * enough results — either way the image is free to use commercially and we
 * always show a credit line.
 */
export async function searchStockPhotos(query: string, count = 8): Promise<StockPhotoCandidate[]> {
  const q = query.trim();
  if (!q) return [];

  const key = process.env.PEXELS_API_KEY?.trim();
  if (key) {
    const p = await searchPexelsMany(q, key, count).catch(() => []);
    if (p.length > 0) return p;
  }

  const cc0 = await searchOpenverseMany(q, count, "cc0,pdm").catch(() => []);
  if (cc0.length >= 4) return cc0;

  const commercial = await searchOpenverseMany(q, count, "by,by-sa,cc0,pdm").catch(() => []);
  // Merge, de-duping by imageUrl, preferring the no-rights-reserved results first.
  const seen = new Set(cc0.map((c) => c.imageUrl));
  const merged = [...cc0];
  for (const c of commercial) {
    if (seen.has(c.imageUrl)) continue;
    seen.add(c.imageUrl);
    merged.push(c);
  }
  return merged.slice(0, count);
}

/** Searches free stock photos: Pexels (if key present) → Openverse fallback. */
export async function searchStockPhoto(query: string): Promise<StockPhoto | null> {
  const candidates = await searchStockPhotos(query, 1);
  const c = candidates[0];
  if (!c) return null;
  return { imageUrl: c.imageUrl, credit: c.credit, source: c.source };
}

/** Downloads a photo, guarding content-type and size. */
export async function fetchPhotoBytes(
  url: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > 12 * 1024 * 1024) return null;
  return { buffer, contentType };
}
