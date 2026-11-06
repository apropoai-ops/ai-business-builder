import { createServiceRoleClient } from "@/lib/supabase/server";
import { PLANS, type PlanDef } from "@/lib/plans";
import { getActiveAddons } from "@/lib/services/addons.service";
import type { PlanTier } from "@/types/database";

/**
 * Plan-quota enforcement. Limits live in lib/plans.ts; usage is tracked
 * monthly per business (usage_counters) and summed per owner, so a user
 * can't multiply their quota by creating businesses.
 *
 * Unlike the rate limiter, quota checks FAIL CLOSED on the check itself
 * (we must not give away unlimited AI on a DB hiccup) but the bump that
 * follows a successful generation is best-effort.
 */

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export const UPGRADE_HINT = "ניתן לשדרג את התוכנית בעמוד התמחור";

/**
 * Internal/founder accounts that get UNLIMITED businesses regardless of plan
 * (for building, testing, and demos — not a public plan). Configurable via the
 * UNLIMITED_BUSINESS_USER_IDS env (comma-separated user ids); defaults to the
 * founder account.
 */
const UNLIMITED_BUSINESS_USERS = new Set(
  (process.env.UNLIMITED_BUSINESS_USER_IDS ??
    "9d1bba47-ad47-440f-a683-89db23360f27")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

async function ownerIdOf(businessId: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
  return data?.owner_id ?? null;
}

/**
 * Pure augmentation of a PlanDef with the effects of a user's active paid
 * add-ons (lib/plans.ts ADDONS). Kept as a standalone pure function (no DB
 * access) so it's unit-testable without a live database — see
 * tests/addons.test.ts.
 *
 *   ai_boost        → doubles aiGenerations & chatMessages
 *   extra_business  → +1 business per active extra_business add-on
 *
 * custom_domain / remove_branding / whatsapp_agent / rentals have no quota
 * effect here — whatsapp_agent/rentals are gated as *features* instead (see
 * lib/entitlements.ts planAllows/planOrAddonAllows), and custom_domain /
 * remove_branding are cosmetic-only (out of scope for now).
 */
export function applyAddonsToPlan(plan: PlanDef, addons: Set<string>): PlanDef {
  if (addons.size === 0) return plan;

  let next = plan;

  if (addons.has("ai_boost")) {
    next = {
      ...next,
      aiGenerations: Number.isFinite(next.aiGenerations) ? next.aiGenerations * 2 : next.aiGenerations,
      chatMessages: Number.isFinite(next.chatMessages) ? next.chatMessages * 2 : next.chatMessages,
    };
  }

  if (addons.has("extra_business")) {
    next = {
      ...next,
      businesses: Number.isFinite(next.businesses) ? next.businesses + 1 : next.businesses,
    };
  }

  return next;
}

export async function getPlanForUser(userId: string): Promise<PlanDef> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("profiles").select("plan").eq("id", userId).maybeSingle();
  const basePlan = PLANS[(data?.plan as PlanTier) ?? "free"];

  const addons = await getActiveAddons(userId).catch(() => new Set<string>());
  const plan = applyAddonsToPlan(basePlan, addons);

  if (UNLIMITED_BUSINESS_USERS.has(userId)) {
    // Founder override — unlimited everything, not just business count.
    return {
      ...plan,
      businesses: Infinity,
      aiGenerations: Infinity,
      chatMessages: Infinity,
      monthlyCostCapUsd: Infinity,
    };
  }
  return plan;
}

export async function getPlanForBusiness(businessId: string): Promise<PlanDef> {
  const ownerId = await ownerIdOf(businessId);
  if (!ownerId) return PLANS.free;
  return getPlanForUser(ownerId);
}

/**
 * The business owner's active paid add-ons (lib/plans.ts ADDONS keys) —
 * convenience wrapper so feature guards can do
 * assertFeature(plan, "whatsapp_agent", await getActiveAddonsForBusiness(businessId))
 * without needing the owner id themselves.
 */
export async function getActiveAddonsForBusiness(businessId: string): Promise<Set<string>> {
  const ownerId = await ownerIdOf(businessId);
  if (!ownerId) return new Set();
  return getActiveAddons(ownerId).catch(() => new Set<string>());
}

/** Monthly usage summed across all the owner's businesses. */
export async function getMonthlyUsage(userId: string): Promise<{
  aiGenerations: number;
  chatMessages: number;
  aiCostUsd: number;
  businesses: number;
}> {
  const s = createServiceRoleClient();
  const { data: businesses } = await s
    .from("businesses").select("id").eq("owner_id", userId);
  const ids = (businesses ?? []).map((b) => b.id);
  if (ids.length === 0) return { aiGenerations: 0, chatMessages: 0, aiCostUsd: 0, businesses: 0 };

  const { data: counters } = await s
    .from("usage_counters").select("ai_generations,ai_chat_msgs,ai_cost_usd")
    .in("business_id", ids).eq("period", currentPeriod());

  let gen = 0, chat = 0, cost = 0;
  for (const c of counters ?? []) {
    gen += c.ai_generations;
    chat += c.ai_chat_msgs;
    cost += Number(c.ai_cost_usd ?? 0);
  }
  return { aiGenerations: gen, chatMessages: chat, aiCostUsd: cost, businesses: ids.length };
}

/**
 * Checks the owner's monthly quota for a usage field WITHOUT bumping it.
 * Throws QuotaExceededError when over the plan limit.
 */
async function assertQuota(
  businessId: string,
  field: "ai_generations" | "ai_chat_msgs",
  limitOf: (p: PlanDef) => number,
  exceededMessage: string,
): Promise<void> {
  const ownerId = await ownerIdOf(businessId);
  if (!ownerId) throw new QuotaExceededError("העסק לא נמצא");

  const plan = await getPlanForUser(ownerId);
  const limit = limitOf(plan);
  if (!Number.isFinite(limit)) return; // unlimited — skip counting reads

  const usage = await getMonthlyUsage(ownerId);
  const used = field === "ai_generations" ? usage.aiGenerations : usage.chatMessages;
  if (used >= limit) {
    throw new QuotaExceededError(`${exceededMessage} (${limit} בחודש בתוכנית ${plan.name}). ${UPGRADE_HINT}.`);
  }
}

/** Bumps a usage counter for this business (best-effort — never throws). */
async function bumpUsage(
  businessId: string,
  field: "ai_generations" | "ai_chat_msgs",
): Promise<void> {
  try {
    const s = createServiceRoleClient();
    await s.rpc("bump_usage", {
      p_business_id: businessId,
      p_field: field,
      p_period: currentPeriod(),
    });
  } catch {
    // Usage accounting must never break the main flow.
  }
}

/**
 * Checks the owner's monthly quota for a usage field and, if allowed,
 * atomically bumps the counter for this business. Throws QuotaExceededError
 * when over the plan limit.
 */
async function checkAndBump(
  businessId: string,
  field: "ai_generations" | "ai_chat_msgs",
  limitOf: (p: PlanDef) => number,
  exceededMessage: string,
): Promise<void> {
  await assertQuota(businessId, field, limitOf, exceededMessage);
  await bumpUsage(businessId, field);
}

/** Check-only quota gate — pair with recordAiGeneration() AFTER a successful
 *  generation so failed generations don't consume the user's quota. */
export async function assertAiGenerationQuota(businessId: string): Promise<void> {
  await assertQuota(
    businessId,
    "ai_generations",
    (p) => p.aiGenerations,
    "הגעתם למכסת יצירות ה-AI החודשית",
  );
}

/** Bump-only — call after a generation actually succeeded. */
export async function recordAiGeneration(businessId: string): Promise<void> {
  await bumpUsage(businessId, "ai_generations");
}

/** Check-only chat gate — pair with recordChatMessage() on stream success. */
export async function assertChatQuota(businessId: string): Promise<void> {
  await assertQuota(
    businessId,
    "ai_chat_msgs",
    (p) => p.chatMessages,
    "הגעתם למכסת הודעות הצ'אט החודשית",
  );
}

/** Bump-only — call after a chat reply actually succeeded. */
export async function recordChatMessage(businessId: string): Promise<void> {
  await bumpUsage(businessId, "ai_chat_msgs");
}

// ── Per-business monthly cost cap (USD) ──────────────────────────────────────
// A dollar ceiling per business, on top of the count-based quotas above. Unlike
// the generation/chat quotas (summed per owner), the cost cap is scoped to a
// single business, so one runaway business can't spend past its plan's ceiling.

/** Alert the owner once a business crosses this fraction of its cost cap. */
export const COST_ALERT_THRESHOLD = 0.8;

/** This business's estimated AI spend (USD) for the current month. */
export async function getMonthlyCostForBusiness(businessId: string): Promise<number> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("usage_counters")
    .select("ai_cost_usd")
    .eq("business_id", businessId)
    .eq("period", currentPeriod())
    .maybeSingle();
  return Number(data?.ai_cost_usd ?? 0);
}

/** Cost-cap status for a business — used by the UI and the 80% alert. */
export async function getCostCapStatus(businessId: string): Promise<{
  used: number;
  cap: number;
  pct: number;
}> {
  const plan = await getPlanForBusiness(businessId);
  const cap = plan.monthlyCostCapUsd;
  const used = await getMonthlyCostForBusiness(businessId);
  const pct = Number.isFinite(cap) && cap > 0 ? used / cap : 0;
  return { used, cap, pct };
}

/**
 * Fails closed when a business has reached its plan's monthly USD cost cap.
 * Called before every billable AI call; the actual spend is recorded after the
 * call via addAiCost (we only know real token counts post-generation, so the
 * cap can overshoot by at most one call — acceptable).
 */
export async function assertUnderCostCap(businessId: string): Promise<void> {
  const plan = await getPlanForBusiness(businessId);
  const cap = plan.monthlyCostCapUsd;
  if (!Number.isFinite(cap) || cap <= 0) return; // unlimited / unset — skip
  const used = await getMonthlyCostForBusiness(businessId);
  if (used >= cap) {
    throw new QuotaExceededError(
      `העסק הגיע לתקרת העלות החודשית של ה-AI ($${cap} בתוכנית ${plan.name}). ${UPGRADE_HINT}.`,
    );
  }
}

/** Adds an estimated USD cost to this business's monthly counter. Best-effort. */
export async function addAiCost(businessId: string, amountUsd: number): Promise<void> {
  if (!(amountUsd > 0)) return;
  try {
    const s = createServiceRoleClient();
    await s.rpc("add_ai_cost", {
      p_business_id: businessId,
      p_period: currentPeriod(),
      p_amount: amountUsd,
    });
  } catch {
    // Cost accounting must never break the main flow.
  }
}

export async function consumeAiGeneration(businessId: string): Promise<void> {
  await checkAndBump(
    businessId,
    "ai_generations",
    (p) => p.aiGenerations,
    "הגעתם למכסת יצירות ה-AI החודשית",
  );
}

export async function consumeChatMessage(businessId: string): Promise<void> {
  await checkAndBump(
    businessId,
    "ai_chat_msgs",
    (p) => p.chatMessages,
    "הגעתם למכסת הודעות הצ'אט החודשית",
  );
}

/** Gate for creating a new business. Returns an error message or null. */
export async function checkBusinessQuota(userId: string): Promise<string | null> {
  const plan = await getPlanForUser(userId);
  if (!Number.isFinite(plan.businesses)) return null;
  const s = createServiceRoleClient();
  const { count } = await s
    .from("businesses").select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if ((count ?? 0) >= plan.businesses) {
    return `בתוכנית ${plan.name} ניתן לנהל עד ${plan.businesses} עסקים. ${UPGRADE_HINT}.`;
  }
  return null;
}

/** Gate for publishing a public site. Returns an error message or null. */
export async function checkPublishQuota(userId: string): Promise<string | null> {
  const plan = await getPlanForUser(userId);
  if (plan.canPublish) return null;
  return `פרסום אתר לכתובת ציבורית זמין מתוכנית סטארטר ומעלה. ${UPGRADE_HINT}.`;
}
