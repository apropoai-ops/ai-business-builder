import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * AI image generation + upload to the public `site-assets` Supabase Storage
 * bucket.
 *
 * Provider order (free first — nothing bills unless every free engine fails):
 * 1. Google Gemini image models when GEMINI_API_KEY is set — free tier when
 *    Google grants image quota (currently 0 for new accounts, kept first so
 *    it takes over automatically if quota appears).
 * 2. Pollinations (flux) — genuinely free, no API key at all.
 * 3. OpenAI Images API (gpt-image-*) — paid, last on purpose.
 */

type ImageSize = "1024x1024" | "1536x1024" | "1792x1024";

export type ImageOptions = {
  /** gpt-image render quality — "high" for hero/logo studio assets (no-op on Gemini). */
  quality?: "low" | "medium" | "high";
  /** "transparent" produces a PNG with alpha (logos). Native on gpt-image;
   *  emulated on Gemini by requesting a pure-white background and keying it out. */
  background?: "transparent" | "opaque";
};

// ---------------------------------------------------------------------------
// Gemini (free tier)
// ---------------------------------------------------------------------------

// Newest first; 2.5 kept for older accounts that still have quota on it.
const GEMINI_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];

const WHITE_BG_SUFFIX =
  "\n\nPlace the design on a plain, solid, pure white (#FFFFFF) background — no shadows, no texture, no gradient on the background itself. The design itself must not contain pure white; use ivory/off-white instead where a light tone is needed.";

const ASPECT_FOR_SIZE: Record<ImageSize, string> = {
  "1024x1024": "1:1",
  "1536x1024": "3:2",
  "1792x1024": "16:9",
};

/**
 * Turns a pure-white BACKGROUND into real alpha transparency (Gemini can't
 * output alpha).
 *
 * Flood-fill from the four corners, not a global threshold: keying every
 * near-white pixel in the frame punched holes through the design itself —
 * ivory (#FFFFF0) inside a mark came out 44% transparent, and white lettering
 * inside a dark medallion disappeared entirely. Only the light region that is
 * actually CONNECTED to the edge is background.
 *
 * Then trim the transparent margin and re-pad evenly, so the mark fills its
 * box instead of floating inside the generator's generous padding.
 */
export async function whiteToAlpha(png: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  const seen = new Uint8Array(W * H);
  const isNearWhite = (p: number) =>
    Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) >= 232;

  const stack: number[] = [];
  // Mark on PUSH, not on pop — otherwise a 1MP frame queues the same pixel from
  // all four neighbours and the stack grows several times larger than it needs.
  const visit = (p: number) => {
    if (p < 0 || p >= W * H || seen[p] || !isNearWhite(p)) return;
    seen[p] = 1;
    stack.push(p);
  };
  visit(0);
  visit(W - 1);
  visit((H - 1) * W);
  visit(H * W - 1);
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % W;
    if (x > 0) visit(p - 1);
    if (x < W - 1) visit(p + 1);
    visit(p - W);
    visit(p + W);
  }

  for (let p = 0; p < W * H; p++) {
    if (!seen[p]) continue;
    const min = Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    data[p * 4 + 3] =
      min >= 250 ? 0 : Math.min(data[p * 4 + 3], Math.round(((250 - min) / 18) * 255));
  }

  const keyed = () => sharp(data, { raw: { width: W, height: H, channels: 4 } });
  try {
    return await keyed()
      .trim({ threshold: 1 })
      .extend({
        top: 24,
        bottom: 24,
        left: 24,
        right: 24,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch {
    // sharp throws when trim finds nothing to keep (a blank frame) — ship the
    // keyed image rather than failing the whole generation.
    return keyed().png().toBuffer();
  }
}

async function callGeminiImages(
  model: string,
  prompt: string,
  size: ImageSize,
  options: ImageOptions,
): Promise<Buffer> {
  const finalPrompt =
    options.background === "transparent" ? `${prompt}${WHITE_BG_SUFFIX}` : prompt;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: ASPECT_FOR_SIZE[size] },
        },
      }),
      // Don't let a hung provider eat the whole route budget before the
      // fallback chain gets a turn.
      signal: AbortSignal.timeout(60_000),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Gemini image API HTTP ${res.status}`);
  }
  const parts: { inlineData?: { data?: string }; text?: string }[] =
    data?.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) {
    const text = parts.find((p) => p.text)?.text?.slice(0, 200);
    throw new Error(text ? `Gemini returned no image: ${text}` : "Gemini returned no image data");
  }

  const buffer = Buffer.from(image.inlineData.data, "base64");
  return options.background === "transparent" ? whiteToAlpha(buffer) : buffer;
}

// ---------------------------------------------------------------------------
// Pollinations (free, no key)
// ---------------------------------------------------------------------------

async function callPollinations(
  prompt: string,
  size: ImageSize,
  options: ImageOptions,
): Promise<Buffer> {
  const [width, height] = size.split("x").map(Number);
  // No alpha support and its "white" backgrounds are noisy/textured, so
  // keying them out looks blotchy — deliver OPAQUE (like ChatGPT logo images)
  // instead of attempting transparency emulation here.
  // The trailing "no fine print" line suppresses this model's habit of adding
  // tiny gibberish caption text along the image edges.
  const finalPrompt =
    (options.background === "transparent"
      ? // Asking for pure white (rather than "a clean studio background") is
        // what makes the unavoidable opaque square read as a logo card on the
        // white/near-white surfaces the site renders it on.
        `${prompt} The design sits on a plain solid pure white #FFFFFF background, no shadow, no gradient, no texture.`
      : prompt) +
    " Absolutely no fine print, no tiny caption text, no watermark text anywhere in the image.";
  // Random seed so a regenerate with the same prompt isn't served from cache.
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}` +
    `?width=${width}&height=${height}&nologo=true&private=true&enhance=false` +
    `&seed=${Math.floor(Math.random() * 1e9)}`;

  let lastError: unknown;
  // Retries smooth over the anonymous-tier rate limit when 3 logos render in
  // parallel. Budget: 2 × 55s + 6s backoff ≈ 116s worst case — comfortably
  // inside the callers' maxDuration=180 (which also has to fit the upload).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(55_000) });
      if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
      // A 200 with an HTML/JSON rate-limit page (not an image) must not be
      // uploaded as a "logo" — reject anything that isn't image/* so the
      // retry/fallback chain runs instead of storing a broken asset.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`Pollinations returned non-image (${contentType || "unknown"})`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 5_000) throw new Error("Pollinations returned an empty image");
      return buffer;
    } catch (e) {
      lastError = e;
      if (attempt < 1) await new Promise((r) => setTimeout(r, 6_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Pollinations failed");
}

// ---------------------------------------------------------------------------
// OpenAI (paid fallback)
// ---------------------------------------------------------------------------

async function callOpenAiImages(
  model: string,
  prompt: string,
  size: string,
  options: ImageOptions = {},
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.background === "transparent" ? { background: "transparent" } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Image API HTTP ${res.status}`);
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no image data");
  return b64;
}

// Newest first; older models as fallback for accounts without access.
const IMAGE_MODELS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];

export type GeneratedImage = {
  buffer: Buffer;
  /** Which provider actually served the request — callers use this to only
   *  charge estimated cost against the paid (OpenAI) fallback. */
  provider: "gemini" | "pollinations" | "openai";
};

export async function generateImage(
  prompt: string,
  size: ImageSize,
  options: ImageOptions = {},
): Promise<GeneratedImage> {
  let lastError: unknown;

  // 1. Gemini free tier (when Google grants image quota).
  if (process.env.GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        return { buffer: await callGeminiImages(model, prompt, size, options), provider: "gemini" };
      } catch (e) {
        lastError = e;
      }
    }
  }

  // 2. Pollinations — always free, no key.
  try {
    return { buffer: await callPollinations(prompt, size, options), provider: "pollinations" };
  } catch (e) {
    lastError = e;
  }

  // 3. OpenAI — paid, last on purpose so nothing bills unless free engines fail.
  if (process.env.OPENAI_API_KEY) {
    for (const model of IMAGE_MODELS) {
      try {
        const b64 = await callOpenAiImages(model, prompt, size, options);
        return { buffer: Buffer.from(b64, "base64"), provider: "openai" };
      } catch (e) {
        lastError = e;
        // Billing/quota errors won't be fixed by switching models — fail fast.
        if (e instanceof Error && /billing|quota|limit/i.test(e.message)) break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("לא מוגדר ספק תמונות (GEMINI_API_KEY או OPENAI_API_KEY)");
}

/** Uploads an asset to site-assets and returns the public URL. */
export async function uploadSiteAsset(
  path: string,
  data: Buffer | string,
  contentType = "image/png",
): Promise<string> {
  const supabase = createServiceRoleClient();

  // Hand storage-js a Blob, never a raw Buffer. With a Buffer, storage-js sends
  // it as the bare fetch body — and on Vercel's runtime that body fell through
  // fetch's body-extraction to `String(buffer)`, i.e. a UTF-8 decode/encode
  // round-trip that replaces every non-text byte with U+FFFD. A 297KB hero webp
  // landed in storage as 548KB of valid-UTF-8 garbage and every browser drew a
  // broken image. A Blob takes storage-js's multipart branch and stays
  // byte-exact on every runtime. The copy into a fresh Uint8Array is the same
  // defence one level down: it guarantees a genuine current-realm view, so Blob
  // can't stringify it either.
  const blob = new Blob([typeof data === "string" ? data : new Uint8Array(data)], {
    type: contentType,
  });

  const { error } = await supabase.storage
    .from("site-assets")
    // A year of browser/CDN caching is safe because the public URL below is
    // cache-busted with ?v= — a regenerated asset is always a new URL.
    .upload(path, blob, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
  // Cache-bust so a regenerated image replaces the old one in browsers.
  return `${pub.publicUrl}?v=${Date.now()}`;
}
