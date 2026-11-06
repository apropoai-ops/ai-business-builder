import { describe, expect, it } from "vitest";

import {
  MAX_COUNTDOWN_LABEL,
  MAX_GALLERY_IMAGES,
  countdownIsoFromLocal,
  countdownLocalFromIso,
  isCountdownExpired,
  normalizeLandingSettings,
} from "@/lib/landing-settings";

/**
 * These settings are written by a form and read by the public renderer with no
 * validation in between (parseLandingSettings is forgiving on purpose), so the
 * normalizer IS the contract. The timezone cases matter most: the owner types
 * Israel wall-clock into a datetime-local field, the server runs in UTC, and a
 * silent 3-hour drift on a campaign deadline is invisible until it's wrong.
 */

describe("countdownIsoFromLocal", () => {
  it("reads a naked datetime-local value as Israel time (summer, UTC+3)", () => {
    expect(countdownIsoFromLocal("2026-08-01T12:00")).toBe("2026-08-01T09:00:00.000Z");
  });

  it("reads a naked value as Israel time in winter too (UTC+2)", () => {
    expect(countdownIsoFromLocal("2026-01-15T12:00")).toBe("2026-01-15T10:00:00.000Z");
  });

  it("accepts optional seconds", () => {
    expect(countdownIsoFromLocal("2026-08-01T12:00:00")).toBe("2026-08-01T09:00:00.000Z");
  });

  it("passes through a value that already carries a zone", () => {
    expect(countdownIsoFromLocal("2026-08-01T09:00:00.000Z")).toBe(
      "2026-08-01T09:00:00.000Z",
    );
    expect(countdownIsoFromLocal("2026-08-01T12:00:00+03:00")).toBe(
      "2026-08-01T09:00:00.000Z",
    );
  });

  it("returns null for empty and unparseable input", () => {
    expect(countdownIsoFromLocal("")).toBeNull();
    expect(countdownIsoFromLocal("   ")).toBeNull();
    expect(countdownIsoFromLocal("בקרוב")).toBeNull();
    expect(countdownIsoFromLocal(null)).toBeNull();
    expect(countdownIsoFromLocal(undefined)).toBeNull();
    expect(countdownIsoFromLocal(1754038800000)).toBeNull();
  });
});

describe("countdownLocalFromIso", () => {
  it("round-trips a stored ISO back into the datetime-local field", () => {
    const iso = countdownIsoFromLocal("2026-08-01T12:00")!;
    expect(countdownLocalFromIso(iso)).toBe("2026-08-01T12:00");
  });

  it("renders in Israel time regardless of the stored offset", () => {
    expect(countdownLocalFromIso("2026-01-15T10:00:00.000Z")).toBe("2026-01-15T12:00");
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(countdownLocalFromIso(null)).toBe("");
    expect(countdownLocalFromIso("")).toBe("");
    expect(countdownLocalFromIso("not-a-date")).toBe("");
  });
});

describe("normalizeLandingSettings", () => {
  it("normalizes a full, valid form", () => {
    const res = normalizeLandingSettings({
      countdownEnabled: true,
      countdownEndsAt: "2026-08-01T12:00",
      countdownLabel: "  ההרשמה נסגרת בעוד  ",
      videoUrl: "  https://youtu.be/dQw4w9WgXcQ  ",
      galleryUrls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.settings).toEqual({
      countdownEnabled: true,
      countdownEndsAt: "2026-08-01T09:00:00.000Z",
      countdownLabel: "ההרשמה נסגרת בעוד",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      galleryUrls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
    });
  });

  it("returns an all-empty settings object for an empty form", () => {
    const res = normalizeLandingSettings({});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.settings).toEqual({
      countdownEnabled: false,
      countdownEndsAt: null,
      countdownLabel: null,
      videoUrl: null,
      galleryUrls: [],
    });
  });

  it("refuses an enabled countdown with no date", () => {
    const res = normalizeLandingSettings({ countdownEnabled: true, countdownEndsAt: "" });
    expect(res).toMatchObject({ ok: false });
  });

  it("refuses a date it cannot parse, even when the timer is off", () => {
    const res = normalizeLandingSettings({ countdownEnabled: false, countdownEndsAt: "מחר" });
    expect(res).toMatchObject({ ok: false });
  });

  it("keeps a date when the timer is off, so toggling back doesn't lose it", () => {
    const res = normalizeLandingSettings({
      countdownEnabled: false,
      countdownEndsAt: "2026-08-01T12:00",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.settings.countdownEnabled).toBe(false);
    expect(res.settings.countdownEndsAt).toBe("2026-08-01T09:00:00.000Z");
  });

  it("refuses an over-long countdown label", () => {
    const res = normalizeLandingSettings({
      countdownLabel: "א".repeat(MAX_COUNTDOWN_LABEL + 1),
    });
    expect(res).toMatchObject({ ok: false });
  });

  it("refuses a video link that cannot be embedded", () => {
    for (const bad of [
      "https://example.com/video.mp4",
      "javascript:alert(1)",
      "https://www.youtube.com/",
      "not a url",
    ]) {
      expect(normalizeLandingSettings({ videoUrl: bad })).toMatchObject({ ok: false });
    }
  });

  it("accepts every video form the renderer can embed", () => {
    for (const good of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://vimeo.com/123456789",
    ]) {
      const res = normalizeLandingSettings({ videoUrl: good });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.settings.videoUrl).toBe(good);
    }
  });

  it("drops junk gallery entries and de-duplicates", () => {
    const res = normalizeLandingSettings({
      galleryUrls: [
        "https://cdn.example.com/a.jpg",
        "https://cdn.example.com/a.jpg",
        " https://cdn.example.com/b.jpg ",
        "javascript:alert(1)",
        "data:image/png;base64,AAA",
        "/relative/c.jpg",
        "",
        42,
        null,
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.settings.galleryUrls).toEqual([
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
    ]);
  });

  it("refuses more images than the gallery renders", () => {
    const urls = Array.from(
      { length: MAX_GALLERY_IMAGES + 1 },
      (_, i) => `https://cdn.example.com/${i}.jpg`,
    );
    expect(normalizeLandingSettings({ galleryUrls: urls })).toMatchObject({ ok: false });
  });

  it("ignores a non-array galleryUrls instead of throwing", () => {
    const res = normalizeLandingSettings({ galleryUrls: "https://cdn.example.com/a.jpg" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.settings.galleryUrls).toEqual([]);
  });
});

describe("isCountdownExpired", () => {
  const now = Date.parse("2026-08-01T09:00:00.000Z");

  it("flags an enabled timer whose moment has passed", () => {
    expect(
      isCountdownExpired(
        { countdownEnabled: true, countdownEndsAt: "2026-08-01T08:59:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("does not flag a future timer", () => {
    expect(
      isCountdownExpired(
        { countdownEnabled: true, countdownEndsAt: "2026-08-01T09:01:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("never flags a disabled or dateless timer", () => {
    expect(
      isCountdownExpired(
        { countdownEnabled: false, countdownEndsAt: "2020-01-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
    expect(isCountdownExpired({ countdownEnabled: true, countdownEndsAt: null }, now)).toBe(
      false,
    );
  });
});
