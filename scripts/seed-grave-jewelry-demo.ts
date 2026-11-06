/**
 * Recreates the GRAVÉ jewelry demo store — the "צפו באתר לדוגמה" link on the
 * marketing homepage (/s/grave-jewelry-demo). Product names/prices/descriptions
 * are reconstructed from docs/design-studio/baseline/grave-jewelry-demo.html,
 * a captured snapshot of the site taken before the underlying Supabase project
 * was accidentally deleted.
 *
 *   npx tsx --env-file=.env.local scripts/seed-grave-jewelry-demo.ts
 *
 * Re-running is safe: matched by slug, upserted in place.
 */
import { createClient } from "@supabase/supabase-js";

import { generateWebsite } from "@/lib/ai/agents/website";
import { configFromRecommended } from "@/lib/modules";
import { modulesForMode } from "@/lib/site-mode";
import { pickHeroStyle } from "@/lib/hero-style";
import type { Business, Json } from "@/types/database";

const OWNER_ID = "e0a83071-1040-4904-b08f-4d28ed499e3a";
const SLUG = "grave-jewelry-demo";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BUSINESS = {
  owner_id: OWNER_ID,
  name: "GRAVÉ",
  type: "חנות אונליין",
  industry: "תכשיטים",
  location: "תל אביב",
  target_audience: "גברים ונשים שמחפשים מתנה אישית ומיוחדת",
  description:
    "GRAVÉ — תכשיטי חריטה אישית בעיצוב יוקרתי ומודרני. שרשראות, צמידים וטבעות איכותיים במינימליזם נקי, כל פריט ניתן לחריטה אישית (שם, תאריך, מילה). המתנה המושלמת לרגעים המיוחדים בחיים. משלוח חינם מעל ₪199.",
  site_mode: "store" as const,
  catalog_only: true,
  status: "ready" as const,
};

const PRODUCTS = [
  {
    name: "שרשרת חריטה קלאסית — כסף 925",
    description: "שרשרת כסף 925 עם תליון עגול לחריטה אישית — קלאסית ומתאימה לכל אירוע.",
    category: "שרשראות",
    price: 189,
  },
  {
    name: "צמיד חריטה מינימליסטי — גולדפילד",
    description: "צמיד גולדפילד 14K דק עם לוחית קטנה לחריטה — מינימלי וקליל ליומיום.",
    category: "צמידים",
    price: 149,
    sale_price: 119,
  },
  {
    name: "טבעת חריטה עדינה",
    description: "טבעת דקה עם משטח קטן לחריטה פנימית או חיצונית — עדינה ומדויקת.",
    category: "טבעות",
    price: 129,
  },
  {
    name: "שרשרת תליון לב עם חריטה",
    description: "שרשרת עדינה עם תליון לב לחריטת שם או תאריך — מתנת האהבה הקלאסית.",
    category: "שרשראות",
    price: 219,
    sale_price: 179,
  },
  {
    name: "צמיד חרוזים עם לוחית חריטה",
    description: "צמיד חרוזים עדין עם לוחית מלבנית לחריטה — שילוב של יומיומי ואישי.",
    category: "צמידים",
    price: 159,
  },
  {
    name: "שרשרת זוגית — סט 2 חריטות",
    description: "סט שתי שרשראות תואמות עם חריטה על כל אחת — לזוגות, חברות טובות או אחאים.",
    category: "שרשראות",
    price: 249,
  },
];

async function upsertBusiness(): Promise<Business> {
  const { data: existingSite } = await db
    .from("websites")
    .select("business_id")
    .eq("slug", SLUG)
    .maybeSingle();
  const existingId = existingSite?.business_id ?? null;

  if (existingId) {
    const { data, error } = await db
      .from("businesses")
      .update(BUSINESS)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw new Error(`update business: ${error.message}`);
    return data as Business;
  }

  const { data, error } = await db.from("businesses").insert(BUSINESS).select("*").single();
  if (error) throw new Error(`insert business: ${error.message}`);
  return data as Business;
}

async function seedBrand(businessId: string) {
  const row = {
    business_id: businessId,
    brand_name: "GRAVÉ",
    slogan: "הרגע שלך, חרוט לנצח",
    color_palette: [
      { name: "אפור פלטינה", hex: "#929191", usage: "primary" },
      { name: "זהב עתיק", hex: "#D4AF37", usage: "accent" },
      { name: "שחור עמוק", hex: "#111111", usage: "background" },
    ] as unknown as Json,
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

async function seedProducts(businessId: string) {
  await db.from("products").delete().eq("business_id", businessId);
  await db.from("products").insert(
    PRODUCTS.map((p, i) => ({
      business_id: businessId,
      name: p.name,
      description: p.description,
      price: p.price,
      sale_price: p.sale_price ?? null,
      category: p.category,
      active: true,
      in_stock: true,
      sort_order: i,
    })),
  );
}

async function run() {
  console.log(`▶ ${SLUG} — GRAVÉ`);
  const business = await upsertBusiness();
  await seedBrand(business.id);
  await seedProducts(business.id);

  await db
    .from("businesses")
    .update({
      module_config: configFromRecommended(business, modulesForMode("store")) as Json,
    })
    .eq("id", business.id);

  const heroStyle = pickHeroStyle(business);
  const site = await generateWebsite(business);

  const row = {
    business_id: business.id,
    slug: SLUG,
    published: true,
    generated_at: new Date().toISOString(),
    landing_settings: {} as unknown as Json,
    tracking: {} as unknown as Json,
    page_home: site.home as unknown as Json,
    page_about: site.about as unknown as Json,
    page_services: site.services as unknown as Json,
    page_contact: site.contact as unknown as Json,
    page_faq: site.faq as unknown as Json,
    seo_meta: site.seoMeta as unknown as Json,
    hero_style: heroStyle,
  };

  const { data: existing } = await db
    .from("websites")
    .select("id")
    .eq("business_id", business.id)
    .maybeSingle();
  if (existing) {
    const { error } = await db.from("websites").update(row).eq("id", existing.id);
    if (error) throw new Error(`update website: ${error.message}`);
  } else {
    const { error } = await db.from("websites").insert(row);
    if (error) throw new Error(`insert website: ${error.message}`);
  }

  console.log(`✔ business ${business.id} — /s/${SLUG}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
