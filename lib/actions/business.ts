"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createBusiness,
  setBusinessStatus,
  updateBusinessProfile,
  updateHiddenNavKeys,
  uploadGalleryImage,
} from "@/lib/services/business.service";
import { createJob } from "@/lib/services/job.service";
import { classifyHiddenNavKeys } from "@/lib/ai/agents/nav-relevance";
import { checkBusinessQuota, getPlanForUser } from "@/lib/quota";
import { planAllowsSiteMode, siteModeUpgradeMessage } from "@/lib/entitlements";
import {
  createBusinessSchema,
  type CreateBusinessFormInput,
} from "@/lib/validation/business";

export type CreateBusinessResult = { error: string };

/**
 * Formats the landing-page brief (the spec's five questions) as a labelled
 * block appended to the business description. Returns "" when the owner
 * answered none of them.
 */
function buildLandingBrief(data: {
  product?: string;
  price?: string;
  problem?: string;
  whyYou?: string;
  targetAudience?: string;
}): string {
  const lines = [
    ["המוצר / השירות שהדף מוכר", data.product],
    ["קהל היעד", data.targetAudience],
    ["המחיר", data.price],
    ["הבעיה שהמוצר פותר", data.problem],
    ["למה לבחור דווקא בנו", data.whyYou],
  ]
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([label, value]) => `${label}: ${value!.trim()}`);

  if (lines.length === 0) return "";
  return `\n\n--- בריף לדף נחיתה ---\nזהו דף נחיתה בודד ממוקד המרות (לא אתר תדמית ולא חנות). כתוב קופירייטינג שמוכר.\n${lines.join("\n")}`;
}

/**
 * Creates a business from the wizard, enqueues the business-plan job, and
 * redirects to the business overview where generation is kicked off and
 * progress is shown. Returns an error object only on validation/insert failure.
 */
export async function createBusinessAction(
  input: CreateBusinessFormInput,
  photos?: File[],
): Promise<CreateBusinessResult> {
  const parsed = createBusinessSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const { user } = await requireUser();
  const data = parsed.data;

  const quotaError = await checkBusinessQuota(user.id);
  if (quotaError) return { error: quotaError };

  // The package decides which of the three products you may build. The free
  // trial lists all three (it just can't publish), so this only bites a paying
  // customer who picked a mode above their tier.
  const plan = await getPlanForUser(user.id);
  if (!planAllowsSiteMode(plan, data.siteMode)) {
    return { error: siteModeUpgradeMessage(data.siteMode) };
  }

  // Existing business → enrich the description so EVERY AI agent (which all read
  // business.description) builds a growth/optimization-focused, higher-level
  // system rather than a from-scratch launch plan.
  const existingInfo = data.existingInfo?.trim();
  const withExisting =
    data.isExisting && existingInfo
      ? `${data.description}\n\n--- עסק קיים ופעיל ---\nזהו עסק קיים ופעיל (לא רעיון חדש). בנה תוצרים ברמה הגבוהה ביותר, המתמקדים בצמיחה, ייעול, מינוף נכסים קיימים והרחבת הפעילות — לא בהקמה מאפס.\nפרטי העסק הקיים מהבעלים: ${existingInfo}`
      : data.isExisting
        ? `${data.description}\n\n(הערה: זהו עסק קיים ופעיל — התמקד בצמיחה וייעול ולא בהקמה מאפס.)`
        : data.description;

  // Landing mode → append the campaign brief the same way, so the copywriting
  // agent (and every later agent that reads the description) has the product,
  // the price, the pain and the differentiator without a schema of its own.
  const description =
    data.siteMode === "landing"
      ? `${withExisting}${buildLandingBrief(data)}`
      : withExisting;

  let businessId: string;
  try {
    const business = await createBusiness(user.id, {
      name: data.name || null,
      type: data.type || null,
      industry: data.industry || null,
      location: data.location || null,
      target_audience: data.targetAudience || null,
      budget: data.budget,
      revenue_goal: data.revenueGoal,
      description,
      status: "generating",
      is_existing: data.isExisting ?? false,
      site_mode: data.siteMode,
    });
    businessId = business.id;

    await createJob(businessId, "business_plan");
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "יצירת העסק נכשלה",
    };
  }

  // Best-effort — the wizard's photo step (components/wizard/business-wizard.tsx)
  // can only stage files locally since there's no businessId until this point.
  // A failed upload must not block business creation; the owner can retry from
  // the design tab (lib/actions/gallery.ts).
  for (const file of photos ?? []) {
    try {
      await uploadGalleryImage(businessId, file);
    } catch {
      // Swallowed — see comment above.
    }
  }

  // Best-effort — picks which vertical-specific nav items (e.g. "לוח לילות")
  // actually fit this business, so a retail store never sees a hospitality
  // screen. Never blocks creation: a classification failure just means the
  // business shows every nav item the plan/mode already allow (allow-by-default).
  try {
    const hidden = await classifyHiddenNavKeys({
      id: businessId,
      name: data.name || null,
      industry: data.industry || null,
      type: data.type || null,
      description,
    });
    await updateHiddenNavKeys(businessId, hidden);
  } catch {
    // Swallowed — see comment above.
  }

  redirect(`/businesses/${businessId}/overview`);
}

/**
 * Saves manual edits to the narrative fields of the business plan.
 */
export async function updateBusinessNarrativeAction(
  businessId: string,
  fields: { executive_summary: string; value_proposition: string },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await updateBusinessProfile(businessId, {
      executive_summary: fields.executive_summary,
      value_proposition: fields.value_proposition,
    });
    revalidatePath(`/businesses/${businessId}/plan`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שמירה נכשלה" };
  }
}

/**
 * Queues a fresh business-plan generation and returns to the overview,
 * where progress is shown live.
 */
export async function regenerateBusinessPlanAction(
  businessId: string,
): Promise<void> {
  await requireUser();
  await createJob(businessId, "business_plan");
  await setBusinessStatus(businessId, "generating");
  redirect(`/businesses/${businessId}/overview`);
}
