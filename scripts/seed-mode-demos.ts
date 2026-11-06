/**
 * Creates one END-TO-END demo site per build mode (website / landing / store)
 * so the 3-mode split can be verified on a real, AI-generated site instead of
 * a hand-written fixture.
 *
 *   npx tsx --env-file=.env.local scripts/seed-mode-demos.ts
 *
 * (--env-file, not a dotenv call in the file: ESM hoists imports, so
 * lib/ai/providers.ts would read process.env BEFORE any in-file loader ran and
 * silently fall back to Anthropic instead of the free Gemini path.)
 *
 * It runs the SAME generation path the app runs (lib/ai/agents/website.ts and
 * lib/ai/agents/landing.ts through runStructured), then writes the row with the
 * service-role client because a script has no Supabase auth cookie. Re-running
 * is safe: businesses are matched by their fixed demo slug and regenerated.
 *
 * The 'website' demo deliberately HAS a product — that is the regression this
 * whole package is about: products exist, but a brochure site must not grow a
 * store section, a cart or a wishlist.
 */
import { createClient } from "@supabase/supabase-js";

import { generateWebsite } from "@/lib/ai/agents/website";
import { generateLanding } from "@/lib/ai/agents/landing";
import { configFromRecommended } from "@/lib/modules";
import { modulesForMode, type SiteMode } from "@/lib/site-mode";
import { pickHeroStyle } from "@/lib/hero-style";
import type { Business, Json } from "@/types/database";

const OWNER_ID = "9d1bba47-ad47-440f-a683-89db23360f27";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Demo = {
  slug: string;
  mode: SiteMode;
  name: string;
  type: string;
  industry: string;
  location: string;
  audience: string;
  description: string;
  palette: { name: string; hex: string; usage: string }[];
  slogan: string;
  products?: { name: string; description: string; price: number; category: string }[];
  landingSettings?: Record<string, unknown>;
  tracking?: Record<string, string>;
};

const DEMOS: Demo[] = [
  {
    slug: "demo-website-plumber",
    mode: "website",
    name: "אלון אינסטלציה",
    type: "שירות",
    industry: "אינסטלציה",
    location: "חיפה",
    audience: "בעלי בתים ועסקים בחיפה והקריות",
    description:
      "אלון אינסטלציה — אינסטלטור מוסמך עם 14 שנות ניסיון בחיפה והקריות. פתיחת סתימות, איתור נזילות עם מצלמה תרמית, החלפת דודים, התקנת מערכות מים וביוב לבתים פרטיים ולעסקים. שירות 24/7, אחריות שנתיים על כל עבודה, מחיר סופי מראש בלי הפתעות.",
    palette: [
      { name: "כחול עמוק", hex: "#0F4C81", usage: "primary" },
      { name: "תכלת", hex: "#4FA3D1", usage: "accent" },
      { name: "לבן", hex: "#FFFFFF", usage: "background" },
    ],
    slogan: "מגיעים, מתקנים, נשארים אחראים",
    // A brochure site WITH a product — the store must stay off anyway.
    products: [
      {
        name: "בדיקת נזילות עם מצלמה תרמית",
        description: "איתור מדויק של נזילה נסתרת בלי לשבור קירות. כולל דוח מפורט.",
        price: 450,
        category: "שירותים",
      },
    ],
  },
  {
    slug: "demo-landing-course",
    mode: "landing",
    name: "מאסטרקלאס צילום מוצר",
    type: "קורס דיגיטלי",
    industry: "צילום",
    location: "אונליין",
    audience: "בעלי חנויות אונליין ומותגים קטנים",
    description: `מאסטרקלאס אונליין לצילום מוצר במובייל — 6 שיעורי וידאו שמלמדים בעלי חנויות לצלם את המוצרים שלהם ברמה של סטודיו, בלי ציוד יקר ובלי צלם חיצוני.

--- בריף לדף נחיתה ---
המוצר: מאסטרקלאס דיגיטלי בן 6 שיעורים (4 שעות) לצילום מוצר בטלפון, כולל תבניות תאורה ורשימת ציוד בסיסי עד 200 ש"ח.
קהל היעד: בעלי חנויות אונליין ומותגים קטנים שמשלמים היום אלפי שקלים לצלם או מעלים תמונות חובבניות שלא מוכרות.
מחיר: 690 ש"ח, מחיר השקה 390 ש"ח.
הבעיה: תמונות חלשות הורגות המרות — הלקוח לא קונה מוצר שהוא לא רואה טוב, והצלם החיצוני יקר ואיטי מכדי לצלם כל מוצר חדש.
למה אנחנו: 11 שנות צילום מסחרי, צילמנו לקטלוגים של רשתות גדולות, והשיטה נבדקה על יותר מ-300 תלמידים שהעלו המרות בממוצע בעשרות אחוזים.`,
    palette: [
      { name: "שחור פחם", hex: "#111111", usage: "primary" },
      { name: "כתום להבה", hex: "#FF6A2B", usage: "accent" },
      { name: "קרם", hex: "#FBF7F2", usage: "background" },
    ],
    slogan: "תמונות שמוכרות — מהטלפון שלך",
    landingSettings: {
      countdownEnabled: true,
      // 6 days out — stamped at seed time so the timer is always live.
      countdownEndsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      countdownLabel: "מחיר ההשקה נגמר בעוד",
      videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      galleryUrls: [],
    },
    // Test IDs — real vendor shapes, not real accounts. Proves the scripts
    // load and the events fire; swap for the owner's own IDs to measure.
    tracking: { ga4_id: "G-DEMO12345", meta_pixel_id: "1234567890123456" },
  },
  {
    slug: "demo-store-sole",
    mode: "store",
    name: "URBAN SOLE",
    type: "חנות אונליין",
    industry: "אופנה",
    location: "תל אביב",
    audience: "גילאי 18-35 שאוהבים סניקרס ורחוב",
    description:
      "URBAN SOLE — חנות סניקרס אונליין עם מבחר דגמים נבחרים למותגי רחוב, משלוח עד הבית תוך 48 שעות והחלפות חינם 30 יום. אנחנו בוחרים ידנית כל דגם, מוודאים מקוריות ומספקים ייעוץ מידה אישי בוואטסאפ.",
    palette: [
      { name: "שחור", hex: "#0A0A0A", usage: "primary" },
      { name: "ליים", hex: "#B6FF3C", usage: "accent" },
      { name: "אפור בהיר", hex: "#F4F4F5", usage: "background" },
    ],
    slogan: "הרחוב מתחיל מהנעליים",
    products: [
      { name: "RUNNER 01 שחור", description: "סניקר ריצה יומיומי, סוליית EVA קלה, אפשרות לכל היום.", price: 449, category: "סניקרס" },
      { name: "COURT WHITE", description: "קלאסיקה לבנה מעור מלא — הולך עם הכול.", price: 529, category: "סניקרס" },
      { name: "TRAIL GRIP", description: "סוליית אחיזה לשטח, אטום למים, לחורף הישראלי.", price: 619, category: "שטח" },
    ],
  },
];

async function upsertBusiness(demo: Demo): Promise<Business> {
  // Match by the demo's site slug first, then by name — a previous run that
  // died between the business insert and the website insert must not leave a
  // duplicate business behind.
  const { data: existingSite } = await db
    .from("websites")
    .select("business_id")
    .eq("slug", demo.slug)
    .maybeSingle();
  const { data: byName } = existingSite
    ? { data: null }
    : await db
        .from("businesses")
        .select("id")
        .eq("owner_id", OWNER_ID)
        .eq("name", demo.name)
        .maybeSingle();
  const existingId = existingSite?.business_id ?? byName?.id ?? null;

  const fields = {
    owner_id: OWNER_ID,
    name: demo.name,
    type: demo.type,
    industry: demo.industry,
    location: demo.location,
    target_audience: demo.audience,
    description: demo.description,
    site_mode: demo.mode,
    status: "ready" as const,
  };

  if (existingId) {
    const { data, error } = await db
      .from("businesses")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw new Error(`update business ${demo.slug}: ${error.message}`);
    return data as Business;
  }

  const { data, error } = await db
    .from("businesses")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw new Error(`insert business ${demo.slug}: ${error.message}`);
  return data as Business;
}

async function seedBrand(demo: Demo, businessId: string) {
  const row = {
    business_id: businessId,
    brand_name: demo.name,
    slogan: demo.slogan,
    color_palette: demo.palette as unknown as Json,
    typography: { primary: { font: "Heebo" }, secondary: { font: "Heebo" } } as unknown as Json,
    generated_at: new Date().toISOString(),
  };
  const { data: existing } = await db
    .from("brand_assets")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existing) await db.from("brand_assets").update(row).eq("id", existing.id);
  else await db.from("brand_assets").insert(row);
}

async function seedProducts(demo: Demo, businessId: string) {
  if (!demo.products?.length) return;
  await db.from("products").delete().eq("business_id", businessId);
  await db.from("products").insert(
    demo.products.map((p, i) => ({
      business_id: businessId,
      name: p.name,
      description: p.description,
      price: p.price,
      category: p.category,
      active: true,
      sort_order: i,
    })),
  );
}

/** Page columns for the mode — a plain map so the two shapes don't form a
 *  union the insert typing can't reconcile. */
async function generateSite(demo: Demo, business: Business): Promise<Record<string, Json>> {
  const heroStyle = pickHeroStyle(business);

  if (demo.mode === "landing") {
    const landing = await generateLanding(business);
    return {
      page_landing: landing as unknown as Json,
      page_home: {
        hero: {
          headline: landing.hero.headline,
          subheadline: landing.hero.subheadline,
          cta: { text: landing.hero.ctaText, href: "#lead-form" },
        },
        benefits: [],
        socialProof: business.name ?? "",
      } as unknown as Json,
      seo_meta: landing.seoMeta as unknown as Json,
      hero_style: heroStyle,
    };
  }

  const data = await generateWebsite(business);
  return {
    page_home: data.home as unknown as Json,
    page_about: data.about as unknown as Json,
    page_services: data.services as unknown as Json,
    page_contact: data.contact as unknown as Json,
    page_faq: data.faq as unknown as Json,
    seo_meta: data.seoMeta as unknown as Json,
    hero_style: heroStyle,
  };
}

async function run() {
  for (const demo of DEMOS) {
    const started = Date.now();
    console.log(`\n▶ ${demo.slug} (${demo.mode}) — ${demo.name}`);

    const business = await upsertBusiness(demo);
    await seedBrand(demo, business.id);
    await seedProducts(demo, business.id);

    // Modules are auto-curated per mode, exactly like runWebsiteJob does.
    await db
      .from("businesses")
      .update({
        module_config: configFromRecommended(business, modulesForMode(demo.mode)) as Json,
      })
      .eq("id", business.id);

    const pages = await generateSite(demo, business);

    const row = {
      business_id: business.id,
      slug: demo.slug,
      published: true,
      generated_at: new Date().toISOString(),
      landing_settings: (demo.landingSettings ?? {}) as unknown as Json,
      tracking: (demo.tracking ?? {}) as unknown as Json,
      ...pages,
    };

    const { data: existing } = await db
      .from("websites")
      .select("id")
      .eq("business_id", business.id)
      .maybeSingle();
    if (existing) {
      const { error } = await db.from("websites").update(row).eq("id", existing.id);
      if (error) throw new Error(`update website ${demo.slug}: ${error.message}`);
    } else {
      const { error } = await db.from("websites").insert(row);
      if (error) throw new Error(`insert website ${demo.slug}: ${error.message}`);
    }

    console.log(
      `✔ ${demo.slug} — business ${business.id} — ${Math.round((Date.now() - started) / 1000)}s`,
    );
  }

  console.log("\nDone. Demo sites:");
  for (const d of DEMOS) console.log(`  /s/${d.slug}  (${d.mode})`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
