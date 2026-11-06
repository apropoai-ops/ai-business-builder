/**
 * Per-agent output-token cap for structured AI generations.
 *
 * This is a cost-safety net, not a quality control: caps are set well above
 * real observed output sizes (see comments below) so legitimate generations
 * are never truncated. It only stops a runaway/looping generation from
 * ballooning output cost.
 *
 * Real observed output sizes (tokens), for reference:
 *   website          ~3600
 *   business_plan    ~3800
 *   market_research  ~3400
 *   content          ~4415 (June 2026 successful batch)
 *
 * ⚠️ Lesson (2026-07-20): content/content_calendar/ads were wrongly in the
 * LIGHT set (2500 cap) — their JSON got truncated mid-output and every run
 * failed with "No object generated: could not parse the response". A cap
 * below the real output size doesn't save cost, it breaks the feature.
 */

// Heavy long-form agents: real output can run up to ~4400+ tokens.
// Cap at 8000 (~1.8x headroom over the largest observed real output).
const HEAVY_CAP = 8000;

// The landing agent writes ELEVEN sections in one shot (hero, problem,
// solution, benefits, audience, gallery, video, testimonials, FAQ, CTA, form)
// plus SEO — the largest single structured output in the system, in Hebrew,
// which tokenizes far worse than English. Given the 2026-07-20 truncation
// lesson above, this gets its own generous ceiling rather than sharing HEAVY.
const XL_CAP = 12000;

// Mechanical/structured/light agents (see providers.ts LIGHT_AGENTS): these
// produce short, bounded JSON payloads. Cap at 2500 with generous headroom.
const LIGHT_CAP = 2500;

// Default for any agent not explicitly listed below (safe middle ground).
const DEFAULT_CAP = 4000;

// Extra-large single-shot agents (see XL_CAP).
const XL_AGENTS = new Set<string>(["landing"]);

// Agents known to produce long-form structured content.
const HEAVY_AGENTS = new Set<string>([
  "business_plan",
  "market_research",
  "branding",
  "website",
  "business_insights",
  "hr",
  "logo_design",
  "content",
  "content_calendar",
  "ads",
  // 4 full platform strategies (bio, pillars, sample posts, hashtags each) —
  // well past the light cap; truncated at 2500 exactly like content was.
  "social_media",
]);

// Mechanical/light agents — mirrors LIGHT_AGENTS in lib/ai/providers.ts.
const LIGHT_AGENTS = new Set<string>([
  "stock_keywords",
  "hero_style",
  "site_theme",
  "module_pick",
  "product_attributes",
  "product_gen",
  "product_image",
  "daily_brief",
  "logo_options",
  "restock",
  "sales_forecast",
  "nav_relevance",
]);

/**
 * Returns the max-output-tokens cap for a given agent name. Values are
 * chosen with 1.5-2x headroom over known real output sizes so normal
 * generations are never truncated — this only guards against runaway
 * generations ballooning output cost.
 */
export function maxOutputTokensFor(agent: string): number {
  if (XL_AGENTS.has(agent)) return XL_CAP;
  if (HEAVY_AGENTS.has(agent)) return HEAVY_CAP;
  if (LIGHT_AGENTS.has(agent)) return LIGHT_CAP;
  return DEFAULT_CAP;
}
