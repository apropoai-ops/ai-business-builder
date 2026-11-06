/**
 * Full-bleed scrolling text band — the "advanced" tier's editorial marquee
 * (e.g. a black strip repeating "משלוח חינם מעל ₪199 · תוצרת מקומית · ...").
 * Pure CSS animation (duplicated track for a seamless loop), no client JS.
 * Purely decorative/redundant with real page content, so the whole band is
 * `aria-hidden`. Respects prefers-reduced-motion by hiding the animation and
 * the duplicate track, leaving one static row.
 */
export function MarqueeBand({ items, dark = true }: { items: string[]; dark?: boolean }) {
  const clean = items?.filter((s) => s && s.trim().length > 0) ?? [];
  if (clean.length === 0) return null;

  const bg = dark ? "#000000" : "#ffffff";
  const fg = dark ? "#ffffff" : "#111111";
  // .4 measured 3.66:1 on the black band — a separator, but still a rendered
  // glyph, and cheap to bring over AA.
  const dot = dark ? "rgba(255,255,255,.62)" : "rgba(0,0,0,.55)";

  return (
    <div className="tier-marquee-band" style={{ background: bg, color: fg }} aria-hidden="true">
      <div className="tier-marquee-track">
        <div className="tier-marquee-group">
          {clean.map((item, i) => (
            <span className="tier-marquee-item" key={`a-${i}`}>
              {item}
              <span className="tier-marquee-dot" style={{ color: dot }}>
                •
              </span>
            </span>
          ))}
        </div>
        <div className="tier-marquee-group">
          {clean.map((item, i) => (
            <span className="tier-marquee-item" key={`b-${i}`}>
              {item}
              <span className="tier-marquee-dot" style={{ color: dot }}>
                •
              </span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .tier-marquee-band {
          position: relative;
          width: 100%;
          overflow: hidden;
          padding-block: 1.1rem;
          white-space: nowrap;
        }
        .tier-marquee-track {
          display: flex;
          width: max-content;
          animation: tier-marquee-scroll 26s linear infinite;
          will-change: transform;
        }
        .tier-marquee-group {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .tier-marquee-item {
          display: inline-flex;
          align-items: center;
          font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
          font-size: .8rem;
          letter-spacing: .12em;
          text-transform: uppercase;
          padding-inline-end: 2.5rem;
        }
        .tier-marquee-dot {
          padding-inline-start: 2.5rem;
        }
        @keyframes tier-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tier-marquee-track { animation: none; transform: none; }
          .tier-marquee-group:nth-of-type(2) { display: none; }
        }
      `}</style>
    </div>
  );
}
