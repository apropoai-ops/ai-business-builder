import { AuroraHero } from "./aurora-hero";
import { DenimHero } from "./denim-hero";
import { HorizonHero } from "./horizon-hero";
import { NovaHero } from "./nova-hero";
import { OrbitHero } from "./orbit-hero";
import { SodaHero } from "./soda-hero";
import { SpotlightHero } from "./spotlight-hero";
import { VanguardHero } from "./vanguard-hero";
import type { DesignTier } from "@/lib/design-tier";
import type { HeroStyleKey } from "@/lib/hero-style";
import ParticleField from "@/components/public/tiers/particle-field";
import { HudFrame } from "@/components/public/tiers/hud-frame";

/**
 * Swappable storefront hero. One of several visual styles, all driven by the
 * business's own brand color + copy so each looks tailored. The owner picks the
 * style (websites.hero_style). "classic" and "cozy" were retired; migration
 * 0080 remapped every site that used them.
 *
 * The registry (keys, Hebrew labels, descriptions) lives in lib/hero-style.ts —
 * the picker, the server action and the AI enum all read the same list from
 * there. Re-exported here for the callers that already import it from this file.
 */
export type HeroStyle = HeroStyleKey;
export { HERO_STYLES } from "@/lib/hero-style";

export type HeroProps = {
  style?: string | null;
  brand: string;
  brandName: string;
  slogan: string | null;
  headline: string;
  subheadline?: string | null;
  ctaText: string;
  /** null when the page has nothing for the CTA to point at (no booking, no
   *  store, no contact form, no WhatsApp) — the hero then omits the button
   *  instead of rendering a dead href="#". */
  ctaHref: string | null;
  /** Second, quieter destination for the styles that are built around a
   *  two-button row (aurora, horizon) — the next-best real target after the
   *  primary CTA took the best one. null when the page has only one place to
   *  send people, and those styles then render a single button. */
  secondaryText?: string | null;
  secondaryHref?: string | null;
  socialProof?: string | null;
  heroImg?: string | null;
  /** Optional per-business seed (e.g. the site slug) used to pick a
   * deterministic decor variant so hero backdrops don't feel copy-pasted
   * across sites. Omit to keep the original default look. */
  seed?: string | null;
  /** Resolved design tier — drives the "professional" tier's live particle
   * backdrop + HUD corner labels, mounted here (not per-hero-style) so every
   * hero variant gets them consistently. Omit for tier-less callers. */
  tier?: DesignTier;
  /** Monospace HUD corner labels (professional tier only) — e.g.
   * [businessName, city, "EST. 2024", category]. */
  hudLabels?: string[];
  /** Owner toggle for the particle-dust + HUD overlay (websites.hero_particles_enabled).
   * Defaults to on (`!== false`) so legacy/tier-less callers that never pass
   * this prop keep the pre-existing always-on behaviour. Off is the right
   * call for styles built around NOT floating anything (denim) or that
   * already carry their own dot texture (vanguard) — the overlay clashed
   * with those rather than complementing them. */
  heroParticlesEnabled?: boolean;
  /** Short trust facts for the styles that run a marquee inside the hero
   * (nova). Same strings the MarqueeBand under the hero uses; omit and the
   * marquee simply doesn't render. */
  marqueeItems?: string[] | null;
};

/**
 * Dispatches to the swappable per-style hero, then wraps it with the
 * `data-el="hero"` hook every design tier styles against (contract #3). The
 * "professional" tier additionally gets a live particle backdrop + HUD corner
 * labels here — mounted once at the dispatcher level (not duplicated across
 * every individual hero-style file) so they layer consistently behind
 * whichever style the business picked. Both are absolutely positioned against
 * this wrapper, which is exactly the `position: relative` ancestor
 * tier-styles.tsx sets up for `[data-tier="professional"] [data-el="hero"]`.
 */
export function StoreHero(p: HeroProps) {
  const heroNode = (() => {
    switch (p.style) {
      case "orbit":
        return <OrbitHero {...p} />;
      case "vanguard":
        return <VanguardHero {...p} />;
      case "aurora":
        return <AuroraHero {...p} />;
      case "horizon":
        return <HorizonHero {...p} />;
      case "nova":
        return <NovaHero {...p} />;
      case "soda":
        return <SodaHero {...p} />;
      case "denim":
        return <DenimHero {...p} />;
      // Spotlight is the fallback: it is the least industry-specific of them
      // all, so an unknown or legacy value still lands somewhere flattering.
      case "spotlight":
      default:
        return <SpotlightHero {...p} />;
    }
  })();

  return (
    <div data-el="hero" className="relative">
      {heroNode}
      {/* AFTER the hero, in a z-1 overlay: every hero style paints an opaque
          background of its own, so mounting these first (they position
          themselves at a negative z-index) hid the tier's whole signature.
          Hero content sits at z-10 in all three styles and stays on top. */}
      {p.tier === "professional" && p.heroParticlesEnabled !== false && (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <ParticleField accent={p.brand} />
          <HudFrame labels={p.hudLabels ?? []} />
        </div>
      )}
    </div>
  );
}

