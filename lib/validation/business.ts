import { z } from "zod";

/**
 * Validation for the Business Creation Wizard (F1).
 * Numeric fields accept empty strings from the form and coerce to numbers.
 */
const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

export const createBusinessSchema = z.object({
  /**
   * Which of the three products the owner is building (see lib/site-mode.ts).
   * Kept as an inline literal tuple because z.enum needs one; tests/site-mode
   * asserts it stays in sync with SITE_MODES.
   */
  siteMode: z.enum(["website", "landing", "store"]).optional().default("website"),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  type: z.string().trim().max(120).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  targetAudience: z.string().trim().max(300).optional().or(z.literal("")),
  budget: optionalNumber,
  revenueGoal: optionalNumber,
  description: z
    .string()
    .trim()
    .min(20, "תארו את הרעיון בלפחות 20 תווים כדי שה-AI יבין אותו")
    .max(2000, "התיאור ארוך מדי (עד 2000 תווים)"),
  isExisting: z.boolean().optional().default(false),
  existingInfo: z.string().trim().max(1500).optional().or(z.literal("")),
  // Landing-mode brief — the five questions the spec says the AI must ask
  // before writing conversion copy. Ignored by the other two modes.
  product: z.string().trim().max(300).optional().or(z.literal("")),
  price: z.string().trim().max(120).optional().or(z.literal("")),
  problem: z.string().trim().max(600).optional().or(z.literal("")),
  whyYou: z.string().trim().max(600).optional().or(z.literal("")),
});

/** Output type (after coercion) — budget/revenueGoal are number | null. */
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
/** Input type (raw form values) — budget/revenueGoal may be strings. */
export type CreateBusinessFormInput = z.input<typeof createBusinessSchema>;
