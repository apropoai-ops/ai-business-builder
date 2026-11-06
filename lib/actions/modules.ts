"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/services/business.service";
import { getWebsite } from "@/lib/services/website.service";
import { runStructured } from "@/lib/ai/run";
import {
  MODULES,
  MODULE_KEYS,
  isCoreToggle,
  normalizeModuleConfig,
  recommendModules,
  resolveModules,
  type ModuleConfig,
  type ModuleKey,
} from "@/lib/modules";
import { getPlanForBusiness } from "@/lib/quota";
import { minPlanFor, moduleLimitFor } from "@/lib/entitlements";
import type { Json } from "@/types/database";

/** Hebrew error when a plan's curated module cap would be exceeded. */
function moduleLimitError(limit: number): string {
  // Named from the plan registry so re-pricing/renaming a package can't leave
  // a stale package name in a user-facing error.
  const full = minPlanFor("all_modules");
  return `בתוכנית הנוכחית ניתן להפעיל עד ${limit} מודולי תוכן באתר. ניתן לשדרג לחבילת ${full.name} כדי לפתוח את כל המודולים.`;
}

/** Enabled CONTENT modules (core toggles like contact/returns/order_tracking
 *  are free and never count against the plan's curated cap). */
function countedEnabled(config: ModuleConfig): number {
  return Object.entries(config).filter(
    ([key, entry]) => entry?.enabled && !isCoreToggle(key as ModuleKey),
  ).length;
}

async function revalidateModules(businessId: string) {
  revalidatePath(`/businesses/${businessId}/sections`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

async function persist(businessId: string, config: ModuleConfig): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ module_config: config as Json })
    .eq("id", businessId);
  if (error) return { error: error.message };
  await revalidateModules(businessId);
  return {};
}

/**
 * Saves the full module config (enabled flags + order) from the picker.
 * Input is normalized to known keys + contiguous sorts before storing.
 */
export async function saveModuleConfigAction(
  businessId: string,
  config: unknown,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };
    const normalized = normalizeModuleConfig(config);
    const plan = await getPlanForBusiness(businessId);
    const limit = moduleLimitFor(plan);
    const enabledCount = countedEnabled(normalized);
    // Enforce the cap only when this save INCREASES the enabled count past it.
    // Legacy/default states (empty config = everything on) may already exceed
    // the cap — reordering or turning modules OFF must never be blocked, or
    // the picker deadlocks for non-premium plans.
    const currentCount = countedEnabled(normalizeModuleConfig(business.module_config));
    if (enabledCount > limit && enabledCount > currentCount) {
      return { error: moduleLimitError(limit) };
    }
    return await persist(businessId, normalized);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

/**
 * Toggles a single module on/off, preserving the current order.
 */
export async function toggleModuleAction(
  businessId: string,
  current: unknown,
  key: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    if (!MODULE_KEYS.includes(key as ModuleKey)) return { error: "מודול לא תקין" };
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const resolved = resolveModules(current);
    const next: ModuleConfig = {};
    resolved.forEach((m, i) => {
      next[m.key] = { enabled: m.key === key ? enabled : m.enabled, sort: i };
    });
    // Turning a CONTENT module on can hit the plan cap; core toggles are free.
    if (enabled && !isCoreToggle(key as ModuleKey)) {
      const plan = await getPlanForBusiness(businessId);
      const limit = moduleLimitFor(plan);
      if (countedEnabled(next) > limit) return { error: moduleLimitError(limit) };
    }
    return await persist(businessId, next);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

/**
 * AI-picks which modules suit this business and enables exactly those
 * (disabling the rest), keeping the canonical order. Falls back to the free
 * keyword heuristic if the model call fails. Returns the chosen keys + reason.
 */
export async function suggestModulesAction(
  businessId: string,
): Promise<{ error?: string; enabled?: ModuleKey[]; reason?: string }> {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) return { error: "העסק לא נמצא" };

  // The AI only curates CONTENT modules — the core form toggles (contact /
  // returns / order_tracking) keep whatever state the owner set and are never
  // auto-disabled (losing the lead form silently was a real bug).
  const contentModules = MODULES.filter((m) => !isCoreToggle(m.key));
  const contentKeys = contentModules.map((m) => m.key);

  let chosen: ModuleKey[];
  let reason = "נבחר אוטומטית לפי סוג העסק";
  try {
    const result = await runStructured({
      agent: "module_pick",
      businessId,
      schema: z.object({
        modules: z
          .array(z.enum(contentKeys as [ModuleKey, ...ModuleKey[]]))
          .describe("רשימת מפתחות המודולים שכדאי להפעיל לעסק הזה"),
        reason: z.string().describe("נימוק קצר בעברית, משפט אחד"),
      }),
      system: `אתה יועץ לבניית אתרים שבוחר אילו מודולי תוכן להציג באתר עסקי.
לפניך רשימת מודולים אפשריים — בחר רק את אלה שבאמת רלוונטיים לעסק (בדרך כלל 4-9):
${contentModules.map((m) => `- ${m.key}: ${m.label} — ${m.description}`).join("\n")}
העדף איכות על כמות. "testimonials" ו-"faqs" מתאימים כמעט לכל עסק. החזר את רשימת המפתחות + נימוק קצר בעברית.`,
      prompt: [
        `שם: ${business.name ?? ""}`,
        `תחום: ${business.industry ?? business.type ?? ""}`,
        `תיאור: ${business.description.slice(0, 400)}`,
      ].join("\n"),
    });
    chosen = result.modules.filter((k) => !isCoreToggle(k));
    reason = result.reason || reason;
    if (chosen.length === 0) chosen = recommendModules(business).filter((k) => !isCoreToggle(k));
  } catch {
    chosen = recommendModules(business).filter((k) => !isCoreToggle(k));
    reason = "נבחר לפי סוג העסק (התאמה מהירה)";
  }

  // Cap to the plan's curated module limit (the store tier = unlimited).
  const plan = await getPlanForBusiness(businessId);
  const limit = moduleLimitFor(plan);
  if (Number.isFinite(limit) && chosen.length > limit) {
    chosen = chosen.slice(0, limit);
    reason += ` (הוצג מספר מוגבל של מודולים בהתאם לתוכנית — ניתן לשדרג לחבילת ${minPlanFor("all_modules").name} לכל המודולים)`;
  }

  const enabledSet = new Set<ModuleKey>(chosen);
  // Keep current order; flip enabled flags for content modules only — core
  // toggles keep their current state.
  const resolved = resolveModules(business.module_config);
  const next: ModuleConfig = {};
  resolved.forEach((m, i) => {
    next[m.key] = {
      enabled: isCoreToggle(m.key) ? m.enabled : enabledSet.has(m.key),
      sort: i,
    };
  });

  const res = await persist(businessId, next);
  if (res.error) return res;
  const finalEnabled = MODULE_KEYS.filter((k) => next[k]?.enabled);
  return { enabled: finalEnabled, reason };
}
