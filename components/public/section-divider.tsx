/**
 * Subtle, deterministic section-divider shape (wave/blob) drawn between
 * storefront sections for a more "designed" transition. Pure inline SVG,
 * brand-tinted, zero JS cost, pointer-events-none, no layout shift (fixed
 * small height). Same (brand, seed) always renders the same shape; different
 * seeds/sections render visibly different curves.
 */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function SectionDivider({
  brand,
  seed,
  flip = false,
}: {
  brand: string;
  seed: string;
  flip?: boolean;
}) {
  const h = hashSeed(seed);
  const variant = h % 3; // 0=wave, 1=double-wave, 2=arc-blob
  const amp = 18 + (h % 22);
  const opacity = 0.05 + ((h >> 6) % 5) * 0.012;

  let path: string;
  if (variant === 0) {
    path = `M0,${30 + amp} C360,${30 - amp} 1080,${30 + amp} 1440,${30 - amp * 0.6} L1440,0 L0,0 Z`;
  } else if (variant === 1) {
    path = `M0,${18 + amp * 0.5} C240,${10} 480,${40 + amp} 720,${20 + amp * 0.3} C960,${amp} 1200,${36 + amp * 0.6} 1440,${16} L1440,0 L0,0 Z`;
  } else {
    path = `M0,10 C480,${50 + amp} 960,${-10 + amp * 0.4} 1440,20 L1440,0 L0,0 Z`;
  }

  return (
    <div
      className="pointer-events-none relative h-8 w-full overflow-hidden sm:h-12"
      aria-hidden="true"
      style={flip ? { transform: "scaleY(-1)" } : undefined}
    >
      <svg
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
      >
        <path d={path} fill={brand} opacity={opacity} />
      </svg>
    </div>
  );
}
