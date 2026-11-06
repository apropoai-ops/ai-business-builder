import { describe, expect, it } from "vitest";

import { toVideoEmbedUrl } from "@/lib/video-embed";

describe("toVideoEmbedUrl", () => {
  it("converts every YouTube URL shape an owner might paste", () => {
    const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
    expect(toVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(embed);
    expect(toVideoEmbedUrl("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe(embed);
    expect(toVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(embed);
    expect(toVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(embed);
    expect(toVideoEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(embed);
    expect(toVideoEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(embed);
    expect(toVideoEmbedUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(embed);
  });

  it("accepts a URL with no protocol — people paste from the address bar", () => {
    expect(toVideoEmbedUrl("youtu.be/dQw4w9WgXcQ")).toContain("/embed/dQw4w9WgXcQ");
    expect(toVideoEmbedUrl("  https://youtu.be/dQw4w9WgXcQ  ")).toContain("dQw4w9WgXcQ");
  });

  it("converts Vimeo links", () => {
    expect(toVideoEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    expect(toVideoEmbedUrl("https://player.vimeo.com/video/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("returns null for anything it cannot embed, so the section hides", () => {
    expect(toVideoEmbedUrl("")).toBeNull();
    expect(toVideoEmbedUrl("   ")).toBeNull();
    expect(toVideoEmbedUrl(null)).toBeNull();
    expect(toVideoEmbedUrl(undefined)).toBeNull();
    expect(toVideoEmbedUrl(42)).toBeNull();
    expect(toVideoEmbedUrl("not a url at all")).toBeNull();
    expect(toVideoEmbedUrl("https://youtube.com/")).toBeNull();
    expect(toVideoEmbedUrl("https://youtube.com/watch?v=short")).toBeNull();
    expect(toVideoEmbedUrl("https://vimeo.com/notanid")).toBeNull();
    expect(toVideoEmbedUrl("https://example.com/video.mp4")).toBeNull();
  });

  it("refuses non-http schemes (no javascript: in an iframe src)", () => {
    expect(toVideoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(toVideoEmbedUrl("data:text/html,<script>")).toBeNull();
  });
});
