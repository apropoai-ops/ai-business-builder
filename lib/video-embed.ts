/**
 * Turns a YouTube/Vimeo page URL (what an owner actually copies from the
 * address bar or the "share" button) into the embeddable player URL.
 *
 * Pure & dependency-free so the landing renderer, the settings form and the
 * tests can all share one definition of "is this a usable video link".
 * Returns null for anything it can't confidently embed — the video section
 * then hides itself rather than rendering a broken frame.
 */
export function toVideoEmbedUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return isYouTubeId(id) ? youTubeEmbed(id) : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=<id>
    const v = url.searchParams.get("v");
    if (isYouTubeId(v)) return youTubeEmbed(v!);
    // /embed/<id>, /shorts/<id>, /live/<id>
    const [first, second] = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live", "v"].includes(first ?? "") && isYouTubeId(second)) {
      return youTubeEmbed(second!);
    }
    return null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((p) => /^\d{6,}$/.test(p));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}

function isYouTubeId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[\w-]{11}$/.test(value);
}

function youTubeEmbed(id: string): string {
  // nocookie + no related videos keeps the page focused on the offer.
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}
