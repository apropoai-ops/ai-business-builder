/**
 * The "liquid glass" surface shared by the aurora / horizon / nova hero styles.
 *
 * A frosted panel that reads as glass over moving video: a nearly-transparent
 * fill blended in `luminosity` so the backdrop's colour comes through while its
 * brightness is flattened, a 4px backdrop blur, and an inset highlight along the
 * top edge. The signature is the `::before` ring — a vertical white gradient
 * clipped to a 1.4px band by XOR-compositing a content-box mask against a full
 * mask, which produces a border that is bright at the top and bottom edges and
 * invisible at the sides. A plain `border` cannot do that.
 *
 * Exported as a CSS string (not a Tailwind layer) because every hero style in
 * this folder ships its own scoped <style> block — one hero renders per page, so
 * there is nothing to collide with, and the styles stay next to the markup that
 * uses them.
 */
export const LIQUID_GLASS_CSS = `
  .liquid-glass {
    background: rgba(255, 255, 255, 0.01);
    background-blend-mode: luminosity;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: none;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }
  .liquid-glass::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1.4px;
    background: linear-gradient(180deg,
      rgba(255,255,255,0.45) 0%,
      rgba(255,255,255,0.15) 20%,
      rgba(255,255,255,0) 40%,
      rgba(255,255,255,0) 60%,
      rgba(255,255,255,0.15) 80%,
      rgba(255,255,255,0.45) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    pointer-events: none;
  }
  /* A darker fill for glass that sits over bright video, where the 1%-white
     version disappears and takes the text contrast with it. */
  .liquid-glass-dark {
    background: rgba(0, 0, 0, 0.4);
  }
  /* Fallback for browsers with no backdrop-filter (older Firefox with the flag
     off): without the blur the 1%-white fill is invisible, so the panel loses
     its edge entirely. Give it a real tint instead. */
  @supports not ((backdrop-filter: blur(4px)) or (-webkit-backdrop-filter: blur(4px))) {
    .liquid-glass { background: rgba(0, 0, 0, 0.35); }
  }
`;
