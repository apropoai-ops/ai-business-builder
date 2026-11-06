import { z } from "zod";

import { runStructured } from "@/lib/ai/run";
import { HERO_STYLES, HERO_STYLE_KEYS, pickHeroStyle, type HeroStyleKey } from "@/lib/hero-style";
import { SITE_THEMES, SITE_THEME_KEYS, pickSiteTheme, resolveSiteTheme, type SiteThemeKey } from "@/lib/site-theme";
import { SITE_LAYOUT_LIST, LAYOUT_KEYS, type SiteLayoutKey } from "@/lib/site-layout";
import {
  brandForGround, contrastRatio, pickBrandColor, relativeLuminance, type Palette,
} from "@/lib/storefront-brand";
import type { Business } from "@/types/database";

/**
 * THE DESIGN DIRECTOR — one agent that owns the whole look of a business.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The visual identity used to be decided by four agents that never spoke to
 * each other:
 *   · branding      → colour palette + typography
 *   · logo-design   → the logo
 *   · hero_style    → the opening area
 *   · site_theme    → the page's colour scheme
 *
 * Each one was individually reasonable and the combination was nobody's job.
 * That is how a site ends up with a warm terracotta palette on a cold navy
 * ground, an Anton-headline "denim" hero (deliberately flat, no motion) inside
 * a cinematic espresso scheme, or — the expensive one — a brand colour that
 * cannot be read on the very scheme chosen to display it. No single agent was
 * wrong; there was simply no agent whose job was COHERENCE.
 *
 * This one makes all of those calls in a single pass, from one view of the
 * business, and then PROVES the result hangs together before returning it.
 *
 * ── The part that matters most ─────────────────────────────────────────────
 * A model asked for six design decisions will produce six plausible answers
 * and no guarantee they fit. So the model's answer is treated as a PROPOSAL:
 * `reconcile()` below re-derives what must be true (contrast, font support,
 * mood agreement) and repairs what isn't. Everything it changes is reported in
 * `repairs`, so a silent correction can never masquerade as the model's taste.
 *
 * Never throws. With no key, a refusal, or a malformed answer it degrades to
 * the free deterministic pickers — which is exactly what a new site gets today.
 */

/* ── Vocabulary the model must choose from ─────────────────────────────────── */

/** Fonts that actually render Hebrew. A beautiful Latin-only pick is a bug. */
const HEBREW_FONTS = [
  "Heebo", "Assistant", "Rubik", "Varela Round", "Secular One", "Alef",
  "Suez One", "Frank Ruhl Libre", "Karantina", "Amatic SC",
] as const;

/** Serif/display faces here read as editorial; the rest as contemporary. */
const FONT_MOOD: Record<string, "editorial" | "modern" | "playful"> = {
  "Frank Ruhl Libre": "editorial", "Suez One": "editorial", "Secular One": "editorial",
  Heebo: "modern", Assistant: "modern", Rubik: "modern", Alef: "modern",
  "Varela Round": "playful", Karantina: "playful", "Amatic SC": "playful",
};

export const designDirectionSchema = z.object({
  palette: z
    .array(z.object({
      name: z.string().describe("שם הצבע בעברית"),
      hex: z.string().describe("קוד HEX מלא, לדוגמה #2563EB"),
      usage: z.string().describe("שימוש עיקרי"),
    }))
    .describe("4-5 צבעים. הראשון הוא צבע המותג הראשי ובו נצבעים הכפתורים והקישורים"),
  typography: z.object({
    primary: z.string().describe(`פונט כותרות — אחד מתוך: ${HEBREW_FONTS.join(", ")}`),
    secondary: z.string().describe(`פונט טקסט — אחד מתוך: ${HEBREW_FONTS.join(", ")}`),
  }),
  theme: z.enum(SITE_THEME_KEYS as [SiteThemeKey, ...SiteThemeKey[]]),
  heroStyle: z.enum(HERO_STYLE_KEYS as [HeroStyleKey, ...HeroStyleKey[]]),
  layout: z.enum(LAYOUT_KEYS as [SiteLayoutKey, ...SiteLayoutKey[]]),
  logoBrief: z.string().describe("משפט אחד שמנחה את מעצב הלוגו: צורה, אופי, מה להימנע ממנו"),
  rationale: z.string().describe("2-3 משפטים בעברית: למה השילוב הזה מתאים דווקא לעסק הזה"),
});

export type DesignDirection = z.infer<typeof designDirectionSchema> & {
  /** Anything `reconcile()` had to change, in Hebrew, for the owner to see. */
  repairs: string[];
  /** False when the model was unavailable and the free pickers decided. */
  fromModel: boolean;
};

/* ── Coherence rules ───────────────────────────────────────────────────────── */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Hero styles that carry their own strong mood, and the scheme moods they
 * fight with. Only genuine clashes are listed — over-constraining this would
 * collapse every business onto the same safe pair.
 */
const HERO_MOOD: Partial<Record<HeroStyleKey, "playful" | "editorial" | "flat">> = {
  soda: "playful",
  denim: "flat",
  horizon: "editorial",
};

/**
 * Repairs the model's proposal into something that provably works.
 *
 * Order matters: contrast is settled LAST, because the earlier steps can still
 * change which scheme (and therefore which ground) the brand must read on.
 */
function reconcile(proposal: z.infer<typeof designDirectionSchema>): DesignDirection {
  const repairs: string[] = [];

  // 1. Palette: keep only real hexes, and never return an empty palette.
  let palette = proposal.palette.filter((c) => HEX_RE.test(c.hex.trim()));
  if (palette.length !== proposal.palette.length) {
    repairs.push("צבעים בפורמט לא תקין הוסרו מהפלטה");
  }
  if (palette.length === 0) {
    palette = [{ name: "כחול מותג", hex: "#2563EB", usage: "צבע ראשי" }];
    repairs.push("הפלטה שהוחזרה לא הייתה שמישה — הוחלפה בברירת מחדל");
  }

  // 2. Fonts must render Hebrew. A Latin-only face silently falls back to the
  //    browser default on every Hebrew heading, which looks like a broken site.
  const fixFont = (font: string, fallback: string, label: string): string => {
    const hit = HEBREW_FONTS.find((f) => f.toLowerCase() === font?.trim().toLowerCase());
    if (hit) return hit;
    repairs.push(`הפונט ל${label} הוחלף ל-${fallback} (הפונט שנבחר לא תומך בעברית)`);
    return fallback;
  };
  const primary = fixFont(proposal.typography.primary, "Heebo", "כותרות");
  const secondary = fixFont(proposal.typography.secondary, "Assistant", "טקסט");

  // 3. Mood agreement between the hero and the type. A playful hero under an
  //    editorial serif reads as two different companies sharing one page.
  let heroStyle = proposal.heroStyle;
  const heroMood = HERO_MOOD[heroStyle];
  const typeMood = FONT_MOOD[primary];
  if (heroMood === "playful" && typeMood === "editorial") {
    heroStyle = "spotlight";
    repairs.push("אזור הפתיחה הוחלף ל-Spotlight — הסגנון השובב לא הסתדר עם הטיפוגרפיה העורכית");
  }

  // 4. Contrast — the one rule that is not a matter of taste.
  //    The brand colour has to survive as INK on the chosen scheme's hardest
  //    surface. `brandForGround` already lifts it, but a lift that has to
  //    travel a long way stops being the owner's colour, so a scheme that
  //    mangles the brand is swapped instead of quietly overriding the brand.
  let theme = proposal.theme;
  const rawBrand = pickBrandColor(palette as Palette);
  const themeDef = resolveSiteTheme(theme);
  const adjusted = brandForGround(rawBrand, themeDef.inkMeasure);
  if (contrastRatio(rawBrand, themeDef.inkMeasure) < 2) {
    // The brand and the ground are nearly the same tone: whatever we do to the
    // ink, the site loses the brand. Flip to a scheme of the opposite polarity.
    const wantLight = relativeLuminance(rawBrand) < 0.45;
    const alt = SITE_THEMES.find((t) => (wantLight ? t.mode === "light" : t.mode === "dark"));
    if (alt && alt.key !== theme) {
      theme = alt.key;
      repairs.push(
        `ערכת הצבעים הוחלפה ל"${alt.label}" — צבע המותג היה כמעט בלתי נראה על הרקע שנבחר`,
      );
    }
  } else if (adjusted.toLowerCase() !== rawBrand.toLowerCase()) {
    repairs.push("צבע המותג הובהר מעט כדי לעבור תקן נגישות על הרקע שנבחר");
  }

  return {
    palette,
    typography: { primary, secondary },
    theme,
    heroStyle,
    layout: proposal.layout,
    logoBrief: proposal.logoBrief?.trim().slice(0, 300) || "לוגו טיפוגרפי נקי עם סימן גיאומטרי פשוט",
    rationale: proposal.rationale?.trim().slice(0, 600) || "",
    repairs,
    fromModel: true,
  };
}

/**
 * The free, instant, always-available answer. Identical to what a new site is
 * born with today, so a model outage degrades to the current behaviour rather
 * than to something worse.
 */
function deterministicDirection(
  business: Pick<Business, "name" | "industry" | "type" | "description">,
): DesignDirection {
  const theme = pickSiteTheme(business);
  const themeDef = resolveSiteTheme(theme);
  // Anchor the palette on the scheme's own accent so the two agree by
  // construction instead of by luck.
  const brand = brandForGround(themeDef.accent, themeDef.inkMeasure);
  return {
    palette: [
      { name: "צבע מותג", hex: brand, usage: "כפתורים, קישורים והדגשות" },
      { name: "רקע", hex: themeDef.ground, usage: "רקע העמוד" },
      { name: "טקסט", hex: themeDef.ink, usage: "כותרות וטקסט" },
    ],
    typography: { primary: "Heebo", secondary: "Assistant" },
    theme,
    heroStyle: pickHeroStyle(business),
    layout: "flow",
    logoBrief: "לוגו טיפוגרפי נקי בעברית עם סימן גיאומטרי פשוט",
    rationale: "נבחר אוטומטית לפי תחום העסק.",
    repairs: [],
    fromModel: false,
  };
}

/* ── The agent ─────────────────────────────────────────────────────────────── */

function catalogue(): string {
  return [
    "ערכות צבע (theme):",
    ...SITE_THEMES.map((t) => `- ${t.key} (${t.mode === "light" ? "בהיר" : "כהה"}): ${t.label} — ${t.desc}`),
    "",
    "סגנונות אזור פתיחה (heroStyle):",
    ...HERO_STYLES.map((h) => `- ${h.key}: ${h.desc}`),
    "",
    "מבני עמוד (layout):",
    ...SITE_LAYOUT_LIST.map((l) => `- ${l.key}: ${l.label} — ${l.description}`),
  ].join("\n");
}

/**
 * Decides the entire visual identity of a business in one pass.
 *
 * @param business the row; only the descriptive fields are read
 */
export async function designDirection(
  businessId: string,
  business: Pick<Business, "name" | "industry" | "type" | "description">,
): Promise<DesignDirection> {
  try {
    const result = await runStructured({
      agent: "design_director",
      businessId,
      schema: designDirectionSchema,
      system: `אתה מנהל עיצוב (Design Director) שמעצב זהות ויזואלית שלמה לעסק ישראלי.
אתה מחליט על הכול בבת אחת — פלטת צבעים, טיפוגרפיה, ערכת צבעים לאתר, אזור הפתיחה, מבנה העמוד וכיוון הלוגו — כדי שהכול ידבר באותה שפה.

עקרונות (חשובים יותר מהיצירתיות):
1. קוהרנטיות לפני מקוריות. כל בחירה חייבת להסביר את השאר. עסק יוקרתי־שקט לא מקבל אזור פתיחה שובב, ועסק שובב לא מקבל טיפוגרפיה עורכית.
2. צבע המותג חייב להיראות על רקע ערכת הצבעים שבחרת. אל תבחר מותג כהה עם ערכה כהה, או מותג בהיר עם ערכה בהירה.
3. הפלטה נגזרת מהתחום ומהקהל, לא מהאופנה. הצבע הראשון הוא צבע המותג.
4. פונטים — רק מתוך הרשימה: ${HEBREW_FONTS.join(", ")}. כל השאר לא תומך בעברית.
5. ערכה בהירה מתאימה לרוגע, ניקיון, בריאות ורכות. ערכה כהה מתאימה ליוקרה, עוצמה, אווירה ודרמה.

הקטלוג שממנו אתה בוחר:
${catalogue()}

החזר החלטה אחת מלאה ונימוק קצר בעברית.`,
      prompt: [
        `שם: ${business.name ?? ""}`,
        `תחום: ${business.industry ?? business.type ?? ""}`,
        `תיאור: ${(business.description ?? "").slice(0, 400)}`,
      ].join("\n"),
    });

    return reconcile(result);
  } catch {
    return deterministicDirection(business);
  }
}

export { deterministicDirection };
