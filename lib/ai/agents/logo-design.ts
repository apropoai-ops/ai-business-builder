import { z } from "zod";

import { runStructured } from "@/lib/ai/run";
import type { LogoSpec, LogoMotif, LogoShape } from "@/lib/services/svg-design";

/**
 * The design-direction agent behind the free logo/hero generator.
 *
 * It does NOT draw anything. It makes the handful of taste decisions a
 * designer would make in the first two minutes — a latin rendering of the
 * name, the initials, a two-colour palette, one shape and one motif — and
 * lib/services/svg-design.ts renders those into vectors.
 *
 * That split is what makes the feature free: taste comes from a text model on
 * the free tier, and drawing is arithmetic. It also removes the two things
 * image models are worst at — Hebrew lettering, which they garble, and
 * reliability, since a run that fails leaves the owner with nothing.
 */

const MOTIFS = [
  "spark",
  "leaf",
  "wave",
  "diamond",
  "arch",
  "ring",
  "bolt",
  "heart",
  "drop",
  "peak",
] as const;

const SHAPES = ["circle", "rounded", "square", "shield", "none"] as const;

const designSchema = z.object({
  latin: z
    .string()
    .nullable()
    .describe("תעתיק לטיני אלגנטי של שם העסק לשורה משנית. null אם השם כבר לטיני או ארוך מדי"),
  initials: z.string().describe("אות אחת או שתיים לתוך המונוגרמה — מהשם העברי"),
  brandHex: z.string().describe("צבע המותג הראשי, HEX בפורמט #RRGGBB"),
  accentHex: z.string().describe("צבע משני הרמוני לאותו מותג, HEX בפורמט #RRGGBB"),
  shape: z.enum(SHAPES).describe("צורת התג שמסביב לסמל/מונוגרמה"),
  motif: z.enum(MOTIFS).describe("הסמל הגיאומטרי שהכי מייצג את תחום העסק"),
  weight: z.number().describe("עובי הגופן לשם העסק: 500 עד 900"),
  letterSpacing: z.number().describe("ריווח אותיות בשם: 0 עד 6"),
});

const SYSTEM = `אתה מעצב זהות חזותית בכיר. אתה לא מצייר — אתה מקבל את החלטות הטעם שמהן ייבנה לוגו וקטורי נקי ובסיסי.

כללים:
- הלוגו חייב להיות בסיסי, קריא וחד גם בגובה 24 פיקסלים בכותרת אתר. פשטות מנצחת קישוט.
- שני צבעים בלבד, הרמוניים, עם ניגודיות מספקת מול לבן ומול שחור. אם נמסרו צבעי מותג — השתמש בהם.
- motif: בחר את הצורה הגיאומטרית שהכי מתקשרת לתחום העסק מתוך הרשימה הסגורה. אל תבחר "spark" כברירת מחדל עצלה.
- shape: צורה סגורה ויוקרתית (circle/shield) למותגי פרימיום, rounded למודרני וידידותי, square לטכני, none רק כשהסמל חזק לבדו.
- initials: האותיות הראשונות של השם בעברית. שם בן מילה אחת — אות אחת.
- latin: תעתיק לטיני קצר ואלגנטי (לא תרגום מילולי מסורבל). אם השם כבר באנגלית או ארוך מ-20 תווים — החזר null.
- weight: 800-900 למותג נועז, 600-700 למאוזן, 500 למינימלי ויוקרתי.
- letterSpacing: 0-1 לשמות ארוכים, 3-6 לשמות קצרים שצריכים נוכחות.`;

export async function designLogoSpec(args: {
  businessId: string;
  name: string;
  industry: string;
  description: string;
  palette: string[];
  slogan?: string | null;
}): Promise<LogoSpec> {
  const fallbackHex = args.palette[0] ?? "#2563EB";

  let out: z.infer<typeof designSchema> | null = null;
  try {
    out = await runStructured({
      agent: "logo_options",
      businessId: args.businessId,
      schema: designSchema,
      system: SYSTEM,
      prompt: [
        `שם העסק: ${args.name}`,
        `תחום: ${args.industry}`,
        `תיאור: ${args.description.slice(0, 220)}`,
        args.slogan ? `סלוגן: ${args.slogan.slice(0, 120)}` : "",
        `צבעי המותג הקיימים: ${args.palette.slice(0, 4).join(", ") || "אין — בחר בעצמך"}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch {
    // The generator must never leave an owner empty-handed, so a model outage
    // degrades to the brand palette + sane defaults rather than to an error.
    out = null;
  }

  const hex = (v: string | undefined, fb: string) =>
    v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb;
  const num = (v: number | undefined, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fb;

  return {
    name: args.name,
    latin: out?.latin?.trim() ? out.latin.trim() : null,
    initials: out?.initials?.trim() || args.name.trim().charAt(0) || "?",
    brandHex: hex(out?.brandHex, fallbackHex),
    accentHex: hex(out?.accentHex, args.palette[1] ?? fallbackHex),
    shape: (SHAPES as readonly string[]).includes(out?.shape ?? "")
      ? (out!.shape as LogoShape)
      : "rounded",
    motif: (MOTIFS as readonly string[]).includes(out?.motif ?? "")
      ? (out!.motif as LogoMotif)
      : "spark",
    weight: Math.min(900, Math.max(500, Math.round(num(out?.weight, 700)))),
    letterSpacing: Math.min(6, Math.max(0, num(out?.letterSpacing, 2))),
  };
}
