/**
 * Four corner monospace micro-labels + thin corner-bracket borders — the
 * "professional" tier's HUD overlay (e.g. labels like "BUSINESS.NAME",
 * "EST.2019", "TEL AVIV", "LIVE"). Purely decorative chrome laid over the
 * hero, so it's `aria-hidden` + `pointer-events-none`, and hidden on mobile
 * where the cramped viewport has no room for it. The parent must be
 * `position: relative` (the "professional"-tier hero already is, via
 * tier-styles.tsx) — this component fills it with `absolute inset-0` and
 * sits at a negative z-index so it always renders behind the hero's real
 * (non-positioned, in-flow) text content, regardless of DOM order.
 */
export function HudFrame({ labels }: { labels: string[] }) {
  const items = (labels ?? []).filter((s) => s && s.trim().length > 0).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <div
      className="tier-hud pointer-events-none absolute inset-0 -z-10 hidden md:block"
      aria-hidden="true"
    >
      {items.map((label, i) => (
        <span key={i} className={`tier-hud-corner tier-hud-corner--${i}`}>
          <span className="tier-hud-bracket" />
          <span className="tier-hud-label">{label}</span>
        </span>
      ))}
      <style>{`
        .tier-hud-corner {
          position: absolute;
          display: flex;
          align-items: flex-start;
          gap: .5rem;
          padding: 1.25rem;
        }
        .tier-hud-corner--0 { top: 0; inset-inline-start: 0; }
        .tier-hud-corner--1 { top: 0; inset-inline-end: 0; flex-direction: row-reverse; }
        .tier-hud-corner--2 { bottom: 0; inset-inline-start: 0; align-items: flex-end; }
        .tier-hud-corner--3 { bottom: 0; inset-inline-end: 0; align-items: flex-end; flex-direction: row-reverse; }

        .tier-hud-bracket { width: 14px; height: 14px; flex-shrink: 0; }
        .tier-hud-corner--0 .tier-hud-bracket {
          border-inline-start: 1px solid rgba(255,255,255,.35);
          border-block-start: 1px solid rgba(255,255,255,.35);
        }
        .tier-hud-corner--1 .tier-hud-bracket {
          border-inline-end: 1px solid rgba(255,255,255,.35);
          border-block-start: 1px solid rgba(255,255,255,.35);
        }
        .tier-hud-corner--2 .tier-hud-bracket {
          border-inline-start: 1px solid rgba(255,255,255,.35);
          border-block-end: 1px solid rgba(255,255,255,.35);
        }
        .tier-hud-corner--3 .tier-hud-bracket {
          border-inline-end: 1px solid rgba(255,255,255,.35);
          border-block-end: 1px solid rgba(255,255,255,.35);
        }

        .tier-hud-label {
          font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
          font-size: .65rem;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(255,255,255,.55);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
