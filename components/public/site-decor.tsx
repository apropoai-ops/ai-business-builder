import { buildBandSvg } from "@/lib/services/svg-design";

/** Simple deterministic hash — same algorithm as lib/services/svg-design.ts,
 * duplicated locally so this client-safe component has no server-only deps. */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Lightweight brand-tinted flair for content sections — soft corner orbs + a
 * faded dot-grid, with a few deterministic layout variants so different
 * sections of the same site feel distinct rather than repetitive. Pass a
 * `seed` (e.g. the section id) to pick a variant; omit it for the original
 * default look. Absolute + pointer-events-none, so add it as the first child
 * of a `relative overflow-hidden` section.
 */
export function SectionDecor({
  brand,
  dark = false,
  seed,
}: {
  brand: string;
  dark?: boolean;
  seed?: string;
}) {
  const variant = seed ? hashSeed(seed) % 4 : 0;

  const dotColor = dark ? "rgba(255,255,255,.10)" : `${brand}1f`;
  const dotGrid = (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
        backgroundSize: "26px 26px",
        maskImage: "radial-gradient(130% 90% at 50% 0%, black, transparent 80%)",
        WebkitMaskImage: "radial-gradient(130% 90% at 50% 0%, black, transparent 80%)",
      }}
    />
  );

  // Variant 0 (default): orbs top-right + bottom-left, as before.
  if (variant === 0) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -right-20 -top-24 size-64 rounded-full blur-3xl"
          style={{ background: brand, opacity: dark ? 0.16 : 0.07 }}
        />
        <div
          className="absolute -left-24 size-72 rounded-full blur-3xl"
          style={{ background: brand, opacity: dark ? 0.12 : 0.06, bottom: "-80px" }}
        />
        {dotGrid}
      </div>
    );
  }

  // Variant 1: single large centered-top glow + thin ring accent.
  if (variant === 1) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute left-1/2 top-0 size-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
          style={{ background: brand, opacity: dark ? 0.18 : 0.08 }}
        />
        <div
          className="absolute -bottom-16 -left-16 size-56 rounded-full border"
          style={{ borderColor: dark ? "rgba(255,255,255,.14)" : `${brand}33` }}
        />
        {dotGrid}
      </div>
    );
  }

  // Variant 2: mirrored orbs on both bottom corners, softer top.
  if (variant === 2) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -bottom-20 -right-16 size-72 rounded-full blur-3xl"
          style={{ background: brand, opacity: dark ? 0.16 : 0.07 }}
        />
        <div
          className="absolute -bottom-24 -left-16 size-64 rounded-full blur-3xl"
          style={{ background: brand, opacity: dark ? 0.12 : 0.055 }}
        />
        <div
          className="absolute -top-10 right-1/3 size-32 rounded-full border"
          style={{ borderColor: dark ? "rgba(255,255,255,.12)" : `${brand}2a` }}
        />
        {dotGrid}
      </div>
    );
  }

  // Variant 3: diagonal sweep — one large soft blob top-left to bottom-right.
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -left-28 -top-28 size-80 rounded-full blur-3xl"
        style={{ background: brand, opacity: dark ? 0.14 : 0.065 }}
      />
      <div
        className="absolute -bottom-28 -right-20 size-72 rounded-full blur-3xl"
        style={{ background: brand, opacity: dark ? 0.14 : 0.06 }}
      />
      {dotGrid}
    </div>
  );
}

/**
 * Full-width generative-art band, unique per business (deterministic from the
 * brand color + seed). A designed visual break with an optional centered line.
 */
export function GenerativeBand({
  brand,
  seed,
  label,
}: {
  brand: string;
  seed: string;
  label?: string | null;
}) {
  const uri = `data:image/svg+xml,${encodeURIComponent(buildBandSvg(brand, seed))}`;
  return (
    <section
      className="relative flex h-40 items-center justify-center overflow-hidden sm:h-52"
      style={{ backgroundImage: `url("${uri}")`, backgroundSize: "cover", backgroundPosition: "center" }}
      aria-hidden={label ? undefined : true}
    >
      {label && (
        <p className="relative max-w-2xl px-6 text-center text-xl font-bold text-white drop-shadow sm:text-2xl">
          {label}
        </p>
      )}
    </section>
  );
}
