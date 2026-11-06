"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { upsertBrandAssets, getBrandAssets } from "@/lib/services/branding.service";
import { getWebsite, upsertWebsite } from "@/lib/services/website.service";
import { uploadSiteAsset } from "@/lib/services/image-gen";
import { buildBrandHeroSvg, sanitizeSvg } from "@/lib/services/svg-design";
import { designLogoSpec } from "@/lib/ai/agents/logo-design";
import { searchStockPhotos, fetchPhotoBytes, type StockPhotoCandidate } from "@/lib/services/stock-photo";
import { parseSocialLinks, type SocialLink } from "@/lib/social-links";
import { HERO_STYLE_KEYS, isHeroStyleKey, type HeroStyleKey } from "@/lib/hero-style";
import {
  SITE_THEME_KEYS,
  isSiteThemeKey,
  pickSiteTheme,
  resolveSiteTheme,
  type SiteThemeKey,
} from "@/lib/site-theme";
import { runStructured } from "@/lib/ai/run";
import { designDirection } from "@/lib/ai/agents/design-director";
import type { Json } from "@/types/database";

async function revalidateDesign(businessId: string) {
  revalidatePath(`/businesses/${businessId}/branding`);
  revalidatePath(`/businesses/${businessId}/website`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

function validImage(file: unknown): file is File {
  return (
    file instanceof File &&
    file.size > 0 &&
    file.size <= 12 * 1024 * 1024 && // 12MB — phone photos are often 5-12MB
    /^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)
  );
}

/**
 * Hero uploads take ANY still image. No MIME allow-list: phones hand us
 * `image/heic`, screenshots arrive as `image/avif`, and some browsers send an
 * empty type for a drag-and-dropped file — all of which the old allow-list
 * rejected as "קובץ לא תקין" even though sharp decodes them fine. The real
 * gate is whether sharp can read it, which we find out by decoding.
 */
function acceptableUpload(file: unknown): file is File {
  return file instanceof File && file.size > 0 && file.size <= 25 * 1024 * 1024;
}

/**
 * The stored hero master. 3:2 is deliberate: every hero style paints the image
 * full-bleed with object-cover, so the browser re-crops it to whatever the
 * viewport is. A 16:9 master survives a wide desktop hero but gets shaved to a
 * narrow strip on a tall phone; 3:2 is the ratio that loses the least at both
 * ends, and it matches the generated SVG hero canvas (1536x1024).
 */
const HERO_W = 2400;
const HERO_H = 1600;
/** Phone heroes are portrait, so they get their own crop rather than a side-shave. */
const HERO_MOBILE_W = 1200;
const HERO_MOBILE_H = 1600;

/** Upload the customer's own logo file. */
export async function uploadLogoAction(
  businessId: string,
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const file = formData.get("file");
    if (!validImage(file)) return { error: "קובץ לא תקין (PNG/JPG/WebP/SVG עד 12MB)" };

    const raw = Buffer.from(await file.arrayBuffer());
    let body: Buffer | string = raw;
    let outType = file.type;
    let ext = "png";

    if (file.type === "image/svg+xml") {
      // Owner uploads land in a PUBLIC bucket, so they get the same scrub the
      // AI-generated SVGs already get (site-design.ts) — scripts, filters and
      // embedded images out.
      const clean = sanitizeSvg(raw.toString("utf8"));
      if (!clean) {
        return {
          error:
            "קובץ ה-SVG מכיל אלמנטים שאינם נתמכים (סקריפטים, פילטרים או תמונות מוטמעות) — נסו PNG",
        };
      }
      body = clean;
      ext = "svg";
    } else {
      // Normalise raster uploads: reject anything too small to survive a
      // retina header, trim the dead margin, and cap the file so an 11MB phone
      // photo isn't downloaded on every page view of a sticky header.
      const sharp = (await import("sharp")).default;
      const img = sharp(raw).rotate();
      const meta = await img.metadata();
      if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 80) {
        return {
          error: "הלוגו קטן מדי — נדרשים לפחות 200×80 פיקסלים כדי שלא ייראה מטושטש",
        };
      }
      body = await img
        .trim({ threshold: 12 })
        .resize({ width: 1024, height: 512, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
      outType = "image/png";
    }

    const url = await uploadSiteAsset(`${businessId}/logo-custom.${ext}`, body, outType);
    await upsertBrandAssets(businessId, { logo_url: url });
    await revalidateDesign(businessId);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ההעלאה נכשלה" };
  }
}

/** Upload the customer's own hero image. */
export async function uploadHeroAction(
  businessId: string,
  formData: FormData,
): Promise<{ error?: string; url?: string; lowRes?: boolean }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const file = formData.get("file");
    if (!acceptableUpload(file)) return { error: "קובץ לא תקין (תמונה עד 25MB)" };

    // The hero image is the LCP element of every page on the site, and these
    // uploads come straight off a phone — big, often rotated by EXIF only, and
    // in whatever aspect ratio the camera happened to be held at. We take the
    // picture as-is and do the fitting ourselves rather than refusing it.
    const sharp = (await import("sharp")).default;
    const raw = Buffer.from(await file.arrayBuffer());

    let meta;
    try {
      meta = await sharp(raw).metadata();
    } catch {
      return { error: "לא הצלחנו לקרוא את הקובץ הזה כתמונה — נסו PNG, JPG או WebP" };
    }
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    if (srcW < 1 || srcH < 1) {
      return { error: "לא הצלחנו לקרוא את הקובץ הזה כתמונה — נסו PNG, JPG או WebP" };
    }

    // `attention` picks the crop window with the most visual interest instead of
    // blindly taking the middle, so a portrait phone photo of a person keeps the
    // person. This is what makes an arbitrary upload sit correctly in the frame.
    const fit = (w: number, h: number, quality: number) =>
      sharp(raw)
        .rotate() // honour the EXIF orientation flag before measuring anything
        .resize({
          width: w,
          height: h,
          fit: "cover",
          position: sharp.strategy.attention,
          // No withoutEnlargement: a small image is upscaled to fill the frame.
          // Slightly soft beats a stretched or letterboxed hero.
          fastShrinkOnLoad: false,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();

    const [wide, mobile] = await Promise.all([
      fit(HERO_W, HERO_H, 78),
      fit(HERO_MOBILE_W, HERO_MOBILE_H, 72),
    ]);

    // hero-fit.* rather than the old hero-custom.*: the <picture> element keys
    // off this name to know a matching mobile crop exists. Older uploads keep
    // their old filename and keep rendering as a plain <img>.
    const [url] = await Promise.all([
      uploadSiteAsset(`${businessId}/hero-fit.webp`, wide, "image/webp"),
      uploadSiteAsset(`${businessId}/hero-fit-m.webp`, mobile, "image/webp"),
    ]);
    await upsertWebsite(businessId, { hero_image_url: url });
    await revalidateDesign(businessId);

    // Accepted either way — the owner just deserves to know it will look soft.
    const lowRes = srcW < HERO_W / 2 || srcH < HERO_H / 2;
    return { url, lowRes };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ההעלאה נכשלה" };
  }
}

/** Set the chosen AI logo option as the active logo. */
export async function chooseLogoAction(
  businessId: string,
  url: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    // Only allow URLs from our own storage for this business.
    if (!url.includes(`/site-assets/${businessId}/`)) return { error: "כתובת לא חוקית" };

    // The AI options are 1024×1024 PNGs, and the header renders them at 32-40px
    // on every page view. Store a display-sized copy and point logo_url at it;
    // the original stays in the bucket for downloads. Never block the choice on
    // this — on any failure the full-size URL is still a working logo.
    let logoUrl = url;
    if (!/\.svg(\?|$)/i.test(url)) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const sharp = (await import("sharp")).default;
          const small = await sharp(Buffer.from(await res.arrayBuffer()))
            .resize({ height: 256, fit: "inside", withoutEnlargement: true })
            .png({ compressionLevel: 9 })
            .toBuffer();
          logoUrl = await uploadSiteAsset(`${businessId}/logo-display.png`, small, "image/png");
        }
      } catch {
        // keep the original URL
      }
    }
    await upsertBrandAssets(businessId, { logo_url: logoUrl });
    await revalidateDesign(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Sets the storefront hero style (one of the built-in templates). */
export async function setHeroStyleAction(
  businessId: string,
  style: string,
): Promise<{ error?: string }> {
  await requireUser();
  if (!isHeroStyleKey(style)) return { error: "סגנון לא תקין" };
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    await upsertWebsite(businessId, { hero_style: style });
    await revalidateDesign(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Toggles the "professional" tier's particle-dust + HUD-label hero overlay
 *  for this site (websites.hero_particles_enabled). Off is the right call for
 *  hero styles built around NOT floating anything (denim) or that already
 *  carry their own dot texture (vanguard) — the overlay clashes with those
 *  rather than complementing them. */
export async function setHeroParticlesAction(
  businessId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    await upsertWebsite(businessId, { hero_particles_enabled: enabled });
    await revalidateDesign(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/**
 * AI-picks the best hero style for the business (by industry/description) from
 * the built-in templates and applies it. Returns the chosen style + a short reason.
 */
export async function suggestHeroStyleAction(
  businessId: string,
): Promise<{ error?: string; style?: string; reason?: string }> {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) return { error: "העסק לא נמצא" };

  try {
    const result = await runStructured({
      agent: "hero_style",
      businessId,
      schema: z.object({
        style: z.enum(HERO_STYLE_KEYS as [HeroStyleKey, ...HeroStyleKey[]]),
        reason: z.string().describe("נימוק קצר בעברית, משפט אחד"),
      }),
      system: `אתה מעצב מותג שבוחר סגנון אזור-פתיחה (Hero) לאתר עסקי. בחר אחד מהסגנונות:
- orbit: כהה ודינמי, מעגלים מסתובבים — טק, סייבר, פינטק, סטארטאפים, B2B, פלטפורמות דיגיטליות — דינמי וטכנולוגי.
- spotlight: תמונה כהה עם זרקור צבעוני — יופי, יוקרה, וולנס, צלמים, אדריכלים, מסעדות שף, גלריות — דרמטי וקולנועי (הכי טוב עם תמונת נושא).
- vanguard: תמונת רקע מלאה וקולנועית עם כותרת ענקית ממורכזת ונועזת — אופנה, מותגים, סוכנויות יצירתיות, אירועים, בוטיקים, פורטפוליו (מרשים במיוחד עם תמונת נושא).
- aurora: וידאו רץ במסך מלא עם פאנלים של זכוכית מטושטשת (liquid glass) והטקסט בפינה התחתונה — רפואה, קליניקות, טיפול, תזונה, כושר, קואצ'ינג, חינוך והכשרה — רגוע, נקי ויוקרתי.
- horizon: וידאו במלוא עוצמתו ללא הכהיה, כותרת שנבנית אות-אחר-אות ותגית זכוכית בקצה — השקעות, פיננסים, נדל"ן, ביטוח, עריכת דין, ראיית חשבון, ייעוץ עסקי — עורכי, שקט ומהימן.
- nova: כותרת ענקית והצהרתית עם מילה אחת בגרדיאנט צבעי המותג, וידאו נושם ופס אמון רץ בתחתית — תעשייה, לוגיסטיקה, אנרגיה, אוטומציה, תשתיות, מוצרי B2B בקנה מידה גדול — עוצמתי ומודרני.
- soda: רקע גרדיאנט כהה ותוסס בצבע המותג, בועות עולות, כדורי זכוכית שצפים ונדחפים מהעכבר והמוצר צף במרכז ומגיב לתנועה — משקאות, בירה ויין, גלידה, תוספי תזונה ומוצרי צריכה — שובב, צבעוני ומוצר-במרכז (הכי טוב עם תמונת מוצר נקייה).
- denim: שחור מלא, כותרת הלווטיקה ענקית וצפופה, תמונת מוצר בכרטיס מעוגל עם תגית מותג ובלי שום אנימציה — ג'ינס וביגוד, ריהוט, ציוד ספורט, כלי בית וכלי עבודה, מרקטפלייס — מסחרי, חד ומהיר (הכי טוב כשהמטרה היא למכור מוצר, לא לספר סיפור).
שלושת הסגנונות aurora / horizon / nova מנגנים סרטון רקע — בחר בהם כשהעסק מרוויח מתחושת תנועה ויוקרה, ולא כשהתוכן העיקרי הוא תמונת מוצר בודדת.
החזר את ה-style המתאים ביותר ונימוק קצר בעברית.`,
      prompt: [
        `שם: ${business.name ?? ""}`,
        `תחום: ${business.industry ?? business.type ?? ""}`,
        `תיאור: ${business.description.slice(0, 300)}`,
      ].join("\n"),
    });

    await upsertWebsite(businessId, { hero_style: result.style });
    await revalidateDesign(businessId);
    return { style: result.style, reason: result.reason };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ההמלצה נכשלה" };
  }
}

/**
 * THE DESIGN DIRECTOR — replaces four separate "suggest" buttons with one.
 *
 * Palette, typography, colour scheme, hero style, page layout and the logo
 * brief were previously four independent AI calls the owner had to run in the
 * right order and then eyeball for consistency. They are one decision, so they
 * are now one call — and the agent proves the combination works before this
 * ever writes anything (see lib/ai/agents/design-director.ts).
 *
 * The two writes are ordered deliberately: brand assets first, website second.
 * If the second fails the site keeps its previous scheme with a new palette —
 * ugly but coherent, and re-runnable. The reverse order would leave a scheme
 * chosen for a palette that was never saved.
 */
export async function runDesignDirectorAction(
  businessId: string,
): Promise<{
  error?: string;
  rationale?: string;
  repairs?: string[];
  fromModel?: boolean;
  summary?: { theme: string; heroStyle: string; layout: string; fonts: string };
}> {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) return { error: "העסק לא נמצא" };

  try {
    const direction = await designDirection(businessId, business);

    await upsertBrandAssets(businessId, {
      color_palette: direction.palette as unknown as Json,
      typography: {
        primary: { font: direction.typography.primary, usage: "כותרות" },
        secondary: { font: direction.typography.secondary, usage: "טקסט" },
      } as unknown as Json,
    });

    await upsertWebsite(businessId, {
      theme: direction.theme,
      hero_style: direction.heroStyle,
      layout_style: direction.layout,
    });

    await revalidateDesign(businessId);

    return {
      rationale: direction.rationale,
      repairs: direction.repairs,
      fromModel: direction.fromModel,
      summary: {
        theme: resolveSiteTheme(direction.theme).label,
        heroStyle: direction.heroStyle,
        layout: direction.layout,
        fonts: `${direction.typography.primary} / ${direction.typography.secondary}`,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "עיצוב אוטומטי נכשל" };
  }
}

/** Sets the storefront colour scheme (one of the built-in schemes). */
export async function setSiteThemeAction(
  businessId: string,
  theme: string,
): Promise<{ error?: string }> {
  await requireUser();
  if (!isSiteThemeKey(theme)) return { error: "ערכת צבעים לא תקינה" };
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    await upsertWebsite(businessId, { theme });
    await revalidateDesign(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/**
 * AI-picks the colour scheme that fits the business and applies it. Returns the
 * chosen key plus a one-line reason, so the owner sees WHY rather than watching
 * their site change colour unexplained.
 *
 * Falls back to the free deterministic picker (`pickSiteTheme`, the same one
 * that runs at generation time) whenever the model is unavailable or returns
 * something unusable — a colour scheme is not worth failing a click over.
 */
export async function suggestSiteThemeAction(
  businessId: string,
): Promise<{ error?: string; theme?: string; label?: string; reason?: string }> {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) return { error: "העסק לא נמצא" };

  const apply = async (key: SiteThemeKey, reason: string) => {
    await upsertWebsite(businessId, { theme: key });
    await revalidateDesign(businessId);
    return { theme: key, label: resolveSiteTheme(key).label, reason };
  };

  try {
    const result = await runStructured({
      agent: "site_theme",
      businessId,
      schema: z.object({
        theme: z.enum(SITE_THEME_KEYS as [SiteThemeKey, ...SiteThemeKey[]]),
        reason: z.string().describe("נימוק קצר בעברית, משפט אחד"),
      }),
      system: `אתה מעצב מותג שבוחר ערכת צבעים (רקע ואווירה) לאתר עסקי. בחר אחת מהערכות:
- midnight: שחור מלא עם מבטא זהב — קולנועי, יוקרתי וניטרלי. ברירת המחדל כשאין התאמה ברורה, וגם הבחירה לאופנה יוקרתית, מועדונים, בידור ומותגי פרימיום.
- graphite: אפור פחם קריר עם מבטא כסוף — רכב ומוסכים, תעשייה, בנייה ולוגיסטיקה, חדרי כושר וספורט, גיימינג, ציוד וכלי עבודה.
- navy: כחול לילה עמוק — פיננסים, השקעות, ביטוח, נדל"ן, עריכת דין, ראיית חשבון, ייעוץ, סייבר וטכנולוגיה עסקית. משדר אמינות ויציבות.
- forest: ירוק יער עמוק — צימרים ואירוח, טבע ותיירות, אורגני וטבעוני, גינון וחקלאות, יוגה וספא, חיות מחמד וּוטרינריה, קיימות.
- wine: בורדו כהה וחם — מסעדות, ברים, יקבים ומבשלות, שוקולד וקונדיטוריה, קייטרינג, חתונות ואירועים.
- espresso: חום קפה עמוק — בתי קפה ומאפיות, ריהוט ונגרות, עור וקרמיקה, מלאכת יד ובוטיק, מספרות וברברשופ.
- porcelain: עמוד לבן-בהיר עם טקסט כהה — קליניקות ורפואה, שיניים, פיזיותרפיה, תזונה, פסיכולוגיה, חינוך וקורסים, אפליקציות ומוצרים דיגיטליים. אוורירי, נקי וקל לקריאה.
- sand: בז' חם ובהיר — יופי וקוסמטיקה, טיפוח ואסתטיקה, אופנה ותכשיטים, עיצוב פנים, צילום, ילדים ותינוקות. רך ומזמין.
שתי הערכות האחרונות (porcelain, sand) הן עמוד בהיר; כל השאר כהות. בחר בהיר כשהעסק מוכר רוגע, ניקיון, בריאות או רכות, וכהה כשהוא מוכר יוקרה, עוצמה, מקצועיות או אווירה.
החזר את ה-theme המתאים ביותר ונימוק קצר בעברית.`,
      prompt: [
        `שם: ${business.name ?? ""}`,
        `תחום: ${business.industry ?? business.type ?? ""}`,
        `תיאור: ${business.description.slice(0, 300)}`,
      ].join("\n"),
    });

    return await apply(result.theme, result.reason);
  } catch {
    const fallback = pickSiteTheme(business);
    return await apply(fallback, "נבחר לפי תחום העסק");
  }
}

/**
 * Builds the generated hero background: the brand-coloured composition with
 * the business name set into it.
 *
 * This replaced a paid image-model render. The render cost money per click,
 * took up to a minute, could fail outright, and had to be prompted with "no
 * text, no letters" — because an image model asked for a Hebrew business name
 * produces letter-shaped noise. Since the whole point here is a background
 * that carries the business's NAME, an engine that cannot write the name was
 * the wrong tool. The vector version is free, instant, always succeeds, and
 * spells the name correctly.
 */
export async function brandHeroAction(
  businessId: string,
  brandHex: string,
): Promise<{ error?: string; fallback?: boolean }> {
  await requireUser();
  try {
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };
    const hex = /^#[0-9a-fA-F]{6}$/.test(brandHex) ? brandHex : "#2563EB";

    const brand = await getBrandAssets(businessId).catch(() => null);
    const palette =
      (brand?.color_palette as { hex: string }[] | null)
        ?.map((c) => c.hex)
        .filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)) ?? [];
    if (!palette.includes(hex)) palette.unshift(hex);

    const name = brand?.brand_name || business.name || "";

    // The same design agent that drives the logo, so the hero's palette and
    // the latin sub-line match the logo the owner just picked instead of
    // being a second, unrelated set of choices.
    const spec = await designLogoSpec({
      businessId,
      name,
      industry: business.industry || business.type || "כללי",
      description: business.description,
      palette,
      slogan: brand?.slogan ?? null,
    });

    // A new seed each time so pressing the button again gives a visibly
    // different composition rather than the identical picture.
    const svg = buildBrandHeroSvg(spec.brandHex, `${businessId}${Date.now()}`, name, spec.latin);
    const url = await uploadSiteAsset(`${businessId}/hero.svg`, svg, "image/svg+xml");
    await upsertWebsite(businessId, { hero_image_url: url });
    await revalidateDesign(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/**
 * Resolves a user query (Hebrew or English) or the business profile into
 * concise, specific ENGLISH stock-photo search keywords via the
 * "stock_keywords" agent. Falls back to a generic industry-based query.
 */
async function resolveStockKeywords(
  businessId: string,
  business: { type: string | null; industry: string | null; description: string },
  query?: string,
): Promise<string> {
  let q = query?.trim().slice(0, 80) ?? "";
  const hasHebrew = /[֐-׿]/.test(q);
  // Translate/refine to English keywords when the query is empty OR Hebrew —
  // stock search works best in English, so the user can type plain Hebrew.
  if (!q || hasHebrew) {
    try {
      const r = await runStructured({
        agent: "stock_keywords",
        businessId,
        schema: z.object({ keywords: z.string() }),
        system: [
          "You generate 3-6 specific ENGLISH stock-photo search keywords for a business website hero image.",
          "If the user supplies a query (in Hebrew or any language), translate it FAITHFULLY and SPECIFICALLY — keep the exact subject and setting they asked for (e.g. \"אישה אופה לחם בתנור עץ\" -> \"woman baker wood fired oven bread\"). Do NOT drift to generic business/industry terms when a query is given.",
          "Only when NO query is given, derive keywords from the business type/industry/description instead.",
          "Return only the keywords (lowercase, space-separated, no punctuation, no explanations).",
        ].join(" "),
        prompt: q
          ? `User search query (translate faithfully to specific English keywords, subject + setting): ${q}`
          : [
              business.type ? `Type: ${business.type}` : "",
              business.industry ? `Industry: ${business.industry}` : "",
              `Description: ${business.description.slice(0, 300)}`,
            ]
              .filter(Boolean)
              .join("\n"),
      });
      q = r.keywords.trim().slice(0, 80) || q;
    } catch {
      if (!q || hasHebrew) q = business.industry || business.type || "modern business";
    }
  }
  return q;
}

/**
 * Searches up to 8 FREE real-photo candidates (Pexels if PEXELS_API_KEY set,
 * otherwise Openverse CC0/public-domain first) for the user to pick from.
 * Does NOT set anything — purely a search step for the two-step picker UI.
 */
export async function searchHeroPhotosAction(
  businessId: string,
  query?: string,
): Promise<{ error?: string; photos?: StockPhotoCandidate[]; keywords?: string }> {
  await requireUser();
  try {
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };

    const keywords = await resolveStockKeywords(businessId, business, query);
    const photos = await searchStockPhotos(keywords, 8);
    if (photos.length === 0) {
      return { error: "לא נמצאה תמונה מתאימה — נסו ניסוח אחר (אפשר בעברית)", keywords };
    }
    return { photos, keywords };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/**
 * Downloads the chosen free stock photo and sets it as the website hero.
 * `imageUrl` must be an https:// URL; we don't restrict to a host allowlist
 * because free-photo providers (Openverse in particular) serve images from
 * many different origins, but `fetchPhotoBytes` validates the response is
 * actually an image (content-type check) and caps size at 12MB, so an
 * attacker-supplied URL can at worst make us store an image file — no
 * script/HTML execution risk.
 */
export async function chooseHeroPhotoAction(
  businessId: string,
  imageUrl: string,
  credit?: string,
): Promise<{ error?: string; url?: string; credit?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return { error: "כתובת תמונה לא תקינה" };
    }
    if (parsed.protocol !== "https:") return { error: "כתובת תמונה לא תקינה" };

    const bytes = await fetchPhotoBytes(imageUrl);
    if (!bytes) return { error: "הורדת התמונה נכשלה — נסו שוב" };

    const ext = bytes.contentType.includes("png")
      ? "png"
      : bytes.contentType.includes("webp")
        ? "webp"
        : "jpg";
    const url = await uploadSiteAsset(
      `${businessId}/hero-photo.${ext}`,
      bytes.buffer,
      bytes.contentType,
    );
    await upsertWebsite(businessId, { hero_image_url: url });
    await revalidateDesign(businessId);
    return { url, credit };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/**
 * Set a FREE real stock photo as the website hero (legacy one-shot flow:
 * picks the top search result automatically). Kept for backward compat;
 * new UI uses searchHeroPhotosAction + chooseHeroPhotoAction instead.
 */
export async function heroPhotoAction(
  businessId: string,
  query?: string,
): Promise<{ error?: string; url?: string; credit?: string }> {
  const search = await searchHeroPhotosAction(businessId, query);
  if (search.error || !search.photos?.length) {
    return { error: search.error ?? "לא נמצאה תמונה מתאימה — נסו ניסוח אחר (אפשר בעברית)" };
  }
  const top = search.photos[0];
  return chooseHeroPhotoAction(businessId, top.imageUrl, top.credit);
}

/**
 * Saves the storefront social-network links (per-platform URL + on/off).
 * Validation/dedup happens in parseSocialLinks — bad rows are dropped, an
 * entry is `enabled` only when its URL is a valid https link.
 */
export async function saveSocialLinksAction(
  businessId: string,
  links: SocialLink[],
): Promise<{ error?: string; saved?: number; visible?: number }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const clean = parseSocialLinks(Array.isArray(links) ? links.slice(0, 20) : []);
    await upsertWebsite(businessId, { social_links: clean as unknown as Json });
    await revalidateDesign(businessId);
    return { saved: clean.length, visible: clean.filter((l) => l.enabled).length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

/** Save manually-edited branding (colors, fonts, texts). */
export async function updateBrandingAction(
  businessId: string,
  data: {
    brand_name: string;
    slogan: string;
    mission: string;
    vision: string;
    brand_voice: string;
    personality?: string[];
    color_palette: { name: string; hex: string; usage: string }[];
    typography: { primary: { font: string; usage: string }; secondary: { font: string; usage: string } };
  },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const colors = data.color_palette
      .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c.hex))
      .slice(0, 8);
    if (colors.length === 0) return { error: "נדרש לפחות צבע אחד תקין" };

    const personality = (data.personality ?? [])
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 8);

    await upsertBrandAssets(businessId, {
      brand_name: data.brand_name.trim() || null,
      slogan: data.slogan.trim() || null,
      mission: data.mission.trim() || null,
      vision: data.vision.trim() || null,
      brand_voice: data.brand_voice.trim() || null,
      personality: (personality.length ? personality : null) as unknown as Json,
      color_palette: colors as unknown as Json,
      typography: data.typography as unknown as Json,
    });
    await revalidateDesign(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}
