/**
 * The full-bleed hero photo, with a phone-shaped crop swapped in on narrow
 * screens.
 *
 * Every hero style paints this with `object-cover`, which means the BROWSER
 * decides what to throw away. On a wide desktop hero that is harmless; on a
 * tall phone hero a landscape master gets shaved down to a narrow vertical
 * strip and the subject usually falls outside it. So `uploadHeroAction` writes
 * two crops — a 3:2 master and a 3:4 phone crop, each independently framed on
 * the most interesting part of the picture — and this component hands the
 * browser whichever one fits.
 *
 * The mobile source is only offered for assets we know we produced in that
 * pair, identified by the `hero-fit.webp` filename. Anything else (an older
 * upload, a generated SVG, a stock photo) renders as a plain <img>, because a
 * <source> that 404s does NOT fall back to the <img> — it just breaks.
 */

const FIT_MASTER = "/hero-fit.webp";

/** `.../hero-fit.webp?v=123` -> `.../hero-fit-m.webp?v=123`, or null. */
function mobileVariant(src: string): string | null {
  const [path, query] = src.split("?");
  if (!path.endsWith(FIT_MASTER)) return null;
  return `${path.slice(0, -FIT_MASTER.length)}/hero-fit-m.webp${query ? `?${query}` : ""}`;
}

export function HeroImage({
  src,
  className,
  style,
  priority = true,
  alt = "",
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  alt?: string;
}) {
  const mobile = mobileVariant(src);

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      {...(priority ? { fetchPriority: "high" as const } : {})}
      decoding="async"
      className={className}
      style={style}
    />
  );

  if (!mobile) return img;

  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={mobile} type="image/webp" />
      {img}
    </picture>
  );
}

/**
 * The `<link rel=preload>` that goes with it. Heroes preload the hero image to
 * win LCP; the media attribute keeps the phone from preloading the desktop
 * crop it will never paint.
 */
export function HeroImagePreload({ src }: { src: string }) {
  const mobile = mobileVariant(src);
  if (!mobile) return <link rel="preload" as="image" href={src} />;
  return (
    <>
      <link rel="preload" as="image" href={mobile} media="(max-width: 640px)" />
      <link rel="preload" as="image" href={src} media="(min-width: 641px)" />
    </>
  );
}
