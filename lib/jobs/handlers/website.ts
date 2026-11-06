import { generateWebsite } from "@/lib/ai/agents/website";
import { generateLanding } from "@/lib/ai/agents/landing";
import { getBusiness } from "@/lib/services/business.service";
import { upsertWebsite, getWebsite } from "@/lib/services/website.service";
import { createJob, getLatestJob, setJobStatus } from "@/lib/services/job.service";
import { pickHeroStyle } from "@/lib/hero-style";
import { DEFAULT_SITE_THEME, pickSiteTheme } from "@/lib/site-theme";
import { configFromRecommended } from "@/lib/modules";
import { isHospitality } from "@/lib/business-type";
import { modulesForMode, resolveSiteMode } from "@/lib/site-mode";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Business, Json } from "@/types/database";

/**
 * A landing page has no `page_home`, but the shared storefront chrome (page
 * metadata, OG image fallback, header CTA) reads it. This projects the landing
 * hero into that shape so those code paths keep working unchanged.
 */
function landingCompatHome(
  landing: { hero: { headline: string; subheadline: string; ctaText: string } },
  business: Business,
) {
  return {
    hero: {
      headline: landing.hero.headline,
      subheadline: landing.hero.subheadline,
      cta: { text: landing.hero.ctaText, href: "#lead-form" },
    },
    benefits: [],
    socialProof: business.name ?? "",
  };
}

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string }
  | { status: "skipped"; reason: string };

export async function runWebsiteJob(businessId: string): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  let job = await getLatestJob(businessId, "website");
  if (job && (job.status === "running" || job.status === "succeeded")) {
    return job.status === "running"
      ? { status: "running" }
      : { status: "skipped", reason: "כבר הושלם" };
  }
  if (!job) job = await createJob(businessId, "website");

  await setJobStatus(job.id, "running");

  const mode = resolveSiteMode(business.site_mode);

  try {
    // Auto-pick a hero style by industry — but never override an owner's manual
    // choice (anything other than the default 'spotlight' / unset).
    const existing = await getWebsite(businessId);
    const heroStyle =
      !existing?.hero_style || existing.hero_style === "spotlight"
        ? pickHeroStyle(business)
        : existing.hero_style;

    // Same rule for the colour scheme: auto-pick by trade, but never override
    // an owner's manual choice — 'midnight' is both the DB default and the
    // fall-through of the picker, so "still on the default" is the one state
    // we're allowed to replace.
    const theme =
      !existing?.theme || existing.theme === DEFAULT_SITE_THEME
        ? pickSiteTheme(business)
        : existing.theme;

    // A landing page is a different product written by a different agent into a
    // different column — so it gets its own branch and returns early. No
    // modules (its section order is fixed) and no rental seeding.
    if (mode === "landing") {
      const landing = await generateLanding(business);
      await upsertWebsite(businessId, {
        page_landing: landing as unknown as Json,
        // Keep a minimal page_home so shared chrome (metadata, OG image, header)
        // that reads it never sees null on a landing site.
        page_home: landingCompatHome(landing, business) as unknown as Json,
        seo_meta: landing.seoMeta as unknown as Json,
        hero_style: heroStyle,
        // Landing mode renders its own white page outside the scheme system,
        // but store it anyway: a landing customer who later upgrades to a
        // website/store package then already has a fitting scheme.
        theme,
        generated_at: new Date().toISOString(),
      });
      await setJobStatus(job.id, "succeeded");
      return { status: "succeeded" };
    }

    const data = await generateWebsite(business);

    await upsertWebsite(businessId, {
      page_home: data.home as unknown as Json,
      page_about: data.about as unknown as Json,
      page_services: data.services as unknown as Json,
      page_contact: data.contact as unknown as Json,
      page_faq: data.faq as unknown as Json,
      seo_meta: data.seoMeta as unknown as Json,
      hero_style: heroStyle,
      theme,
      generated_at: new Date().toISOString(),
    });

    const sr = createServiceRoleClient();

    // Auto-curate the storefront modules by business type AND by site mode —
    // but only when the owner hasn't configured them yet (empty config), so
    // manual picks survive.
    const currentConfig = (business.module_config ?? {}) as Record<string, unknown>;
    if (Object.keys(currentConfig).length === 0) {
      await sr
        .from("businesses")
        .update({
          module_config: configFromRecommended(business, modulesForMode(mode)) as Json,
        })
        .eq("id", businessId);
    }

    // Hospitality (צימר) business → seed a starter rental unit so the booking
    // section is born visible. The owner edits/adds more in the dashboard.
    if (isHospitality(business)) {
      const { count } = await sr
        .from("rental_units")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId);
      if ((count ?? 0) === 0) {
        await sr.from("rental_units").insert({
          business_id: businessId,
          name: "יחידת אירוח לדוגמה",
          description: "ערכו את פרטי היחידה — תיאור, מחיר ללילה, מספר אורחים ותמונות.",
          nightly_price: 450,
          max_guests: 2,
          active: true,
          sort: 0,
        });
      }
    }

    await setJobStatus(job.id, "succeeded");
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobStatus(job.id, "failed", { error: message });
    return { status: "failed", error: message };
  }
}
