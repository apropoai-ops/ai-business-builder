"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import {
  createLead, updateLead, deleteLead, findLeadByPhone,
  createCustomer, updateCustomer, deleteCustomer,
  createTask, updateTask, deleteTask,
  createDeal, updateDeal, deleteDeal,
  listActivities, addActivity, updateActivityContent, deleteActivity,
  listLeads, listCustomers, listDeals,
  searchCrm, normalizePhoneE164,
  type CrmSearchResults,
} from "@/lib/services/crm.service";
import { getCustomerInsights, type CustomerInsights } from "@/lib/services/customer-insights.service";
import { draftCrmFollowup } from "@/lib/ai/agents/crm-followup";
import type { LeadStatus, DealStage, TaskPriority, CrmActivity, CrmLead, CrmCustomer, CrmDeal } from "@/types/database";

type Result = { error?: string };

function crmPath(businessId: string) {
  return `/businesses/${businessId}/crm`;
}

/** Exact wording used across the CRM dashboard (components/business/crm-dashboard.tsx). */
const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "חדש", contacted: "נוצר קשר", qualified: "מתאים", lost: "אבוד",
};

// ── Leads ──────────────────────────────────────────────────────────────────

export async function createLeadAction(
  businessId: string,
  data: { name: string; phone?: string; email?: string; source?: string; notes?: string },
): Promise<Result & { warning?: string }> {
  await requireUser();
  try {
    let warning: string | undefined;
    const normalizedPhone = data.phone ? normalizePhoneE164(data.phone) : null;
    if (normalizedPhone) {
      const existing = await findLeadByPhone(businessId, normalizedPhone);
      if (existing) warning = `כבר קיים ליד עם אותו מספר טלפון: ${existing.name}`;
    }
    await createLead(businessId, { ...data, status: "new" });
    revalidatePath(crmPath(businessId));
    return { warning };
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

export async function updateLeadStatusAction(
  businessId: string, id: string, status: LeadStatus, lostReason?: string,
): Promise<Result> {
  await requireUser();
  try {
    const trimmedReason = lostReason?.trim() || null;
    await updateLead(id, {
      status,
      last_contacted_at: new Date().toISOString(),
      ...(status === "lost" ? { lost_reason: trimmedReason } : {}),
    });
    await addActivity(businessId, {
      leadId: id,
      kind: "status",
      content: status === "lost" && trimmedReason
        ? `סטטוס עודכן ל${LEAD_STATUS_LABEL[status]} — סיבה: ${trimmedReason}`
        : `סטטוס עודכן ל${LEAD_STATUS_LABEL[status]}`,
    });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

const leadDetailsSchema = z.object({
  name: z.string().trim().min(1, "שם חובה").max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  source: z.string().trim().max(60).optional(),
});

/** Updates a lead's editable identity fields (name/phone/email/source). */
export async function updateLeadDetailsAction(
  businessId: string,
  leadId: string,
  data: { name: string; phone?: string | null; email?: string | null; source?: string | null },
): Promise<Result> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const parsed = leadDetailsSchema.safeParse({
      name: data.name,
      phone: data.phone ?? undefined,
      email: data.email ?? undefined,
      source: data.source ?? undefined,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

    await updateLead(leadId, {
      name: parsed.data.name,
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.source !== undefined && { source: data.source || null }),
    });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Converts a lead into a customer: keeps the lead's notes intact, marks it converted, and opens a linked deal. */
export async function convertLeadAction(
  businessId: string,
  lead: { id: string; name: string; phone: string | null; email: string | null },
): Promise<Result> {
  await requireUser();
  try {
    const customer = await createCustomer(businessId, {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      notes: "הומר מליד",
    });
    await updateLead(lead.id, { status: "qualified", converted_customer_id: customer.id });
    await createDeal(businessId, {
      title: lead.name,
      stage: "lead",
      contact_name: lead.name,
      lead_id: lead.id,
      customer_id: customer.id,
    });
    await addActivity(businessId, { leadId: lead.id, kind: "system", content: "הומר ללקוח" });
    await addActivity(businessId, { customerId: customer.id, kind: "system", content: "הומר מליד" });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Adds a free-text note to a lead's or customer's activity timeline. */
export async function addCrmNoteAction(
  businessId: string,
  target: { leadId?: string; customerId?: string },
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { ok: false, error: "העסק לא נמצא" };
    if (!target.leadId && !target.customerId) return { ok: false, error: "יש לבחור ליד או לקוח" };

    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      return { ok: false, error: "התוכן חייב להיות בין 1 ל-1000 תווים" };
    }

    await addActivity(businessId, {
      leadId: target.leadId ?? null,
      customerId: target.customerId ?? null,
      kind: "note",
      content: trimmed,
    });
    if (target.leadId) {
      await updateLead(target.leadId, { last_contacted_at: new Date().toISOString() });
    }
    revalidatePath(crmPath(businessId));
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Edits a note the owner wrote (only `kind: "note"` activities are editable). */
export async function updateCrmNoteAction(
  businessId: string,
  activityId: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { ok: false, error: "העסק לא נמצא" };
    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      return { ok: false, error: "התוכן חייב להיות בין 1 ל-1000 תווים" };
    }
    await updateActivityContent(businessId, activityId, trimmed);
    revalidatePath(crmPath(businessId));
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Deletes a note the owner wrote (only `kind: "note"` activities are deletable). */
export async function deleteCrmNoteAction(
  businessId: string,
  activityId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { ok: false, error: "העסק לא נמצא" };
    await deleteActivity(businessId, activityId);
    revalidatePath(crmPath(businessId));
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Loads a lead's or customer's activity timeline (notes + auto-logged events), newest first, page 1 by default. */
export async function listCrmActivitiesAction(
  businessId: string,
  target: { leadId?: string; customerId?: string },
  page?: number,
): Promise<{ activities: CrmActivity[]; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { activities: [], error: "העסק לא נמצא" };
    const activities = await listActivities(businessId, target, { page });
    return { activities };
  } catch (e) { return { activities: [], error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Sets (or clears, with `date: null`) a lead's next-follow-up date. */
export async function setLeadFollowUpAction(
  businessId: string,
  leadId: string,
  date: string | null,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { ok: false, error: "העסק לא נמצא" };
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: "תאריך לא תקין" };
    }
    await updateLead(leadId, { next_follow_up_at: date });
    revalidatePath(crmPath(businessId));
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Drafts an AI follow-up message (WhatsApp + optional email) for a lead/customer, grounded in recent timeline activity. */
export async function draftFollowupAction(
  businessId: string,
  input: { name: string; context: string; email?: string | null; leadId?: string; customerId?: string },
): Promise<{ ok: boolean; text?: string; email?: { subject: string; body: string } | null; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { ok: false, error: "העסק לא נמצא" };

    let recentActivity: string[] | undefined;
    if (input.leadId || input.customerId) {
      const activities = await listActivities(businessId, { leadId: input.leadId, customerId: input.customerId });
      recentActivity = activities.slice(0, 5).map((a) => a.content);
    }

    const result = await draftCrmFollowup(businessId, {
      name: input.name,
      context: input.context,
      email: input.email,
      recentActivity,
    });
    return { ok: true, text: result.message, email: result.email };
  } catch (e) {
    // QuotaExceededError (and other AI-pipeline errors) already carry a
    // user-facing Hebrew message — surface it; fall back otherwise.
    return { ok: false, error: e instanceof Error ? e.message : "יצירת ההודעה נכשלה — נסו שוב" };
  }
}

/** Logs that a follow-up draft was sent/copied — appends a timeline note and bumps the lead's last-contacted date. */
export async function logFollowupSentAction(
  businessId: string,
  target: { leadId?: string; customerId?: string },
  channel: "whatsapp" | "email" | "copy",
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    if (!target.leadId && !target.customerId) return { ok: false, error: "יש לבחור ליד או לקוח" };
    const channelLabel = channel === "whatsapp" ? "וואטסאפ" : channel === "email" ? "אימייל" : "הועתק";
    await addActivity(businessId, {
      leadId: target.leadId ?? null,
      customerId: target.customerId ?? null,
      kind: "note",
      content: `נשלחה הודעת מעקב (${channelLabel})`,
    });
    if (target.leadId) {
      await updateLead(target.leadId, { last_contacted_at: new Date().toISOString() });
    }
    revalidatePath(crmPath(businessId));
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "שגיאה" }; }
}

export async function deleteLeadAction(businessId: string, id: string): Promise<Result> {
  await requireUser();
  try {
    await deleteLead(id);
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Loads the next page of leads (used by the "טען עוד" button). */
export async function loadMoreLeadsAction(businessId: string, page: number): Promise<{ items: CrmLead[]; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { items: [], error: "העסק לא נמצא" };
    return { items: await listLeads(businessId, { page }) };
  } catch (e) { return { items: [], error: e instanceof Error ? e.message : "שגיאה" }; }
}

// ── Customers ──────────────────────────────────────────────────────────────

export async function createCustomerAction(
  businessId: string,
  data: { name: string; phone?: string; email?: string; notes?: string },
): Promise<Result> {
  await requireUser();
  try {
    await createCustomer(businessId, data);
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

export async function deleteCustomerAction(businessId: string, id: string): Promise<Result> {
  await requireUser();
  try {
    await deleteCustomer(id);
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

const customerProfileSchema = z.object({
  name: z.string().trim().min(1, "שם חובה").max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").optional(),
});

/** Updates a customer's editable profile fields (name/phone/email/notes/tags/birthday). */
export async function updateCustomerProfileAction(
  customerId: string,
  businessId: string,
  data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    birthday?: string | null;
  },
): Promise<Result> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };

    const parsed = customerProfileSchema.safeParse({
      name: data.name,
      phone: data.phone ?? undefined,
      email: data.email ?? undefined,
      notes: data.notes ?? undefined,
      tags: data.tags ?? undefined,
      birthday: data.birthday ?? undefined,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

    await updateCustomer(customerId, {
      ...(data.name !== undefined && { name: parsed.data.name }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.tags !== undefined && { tags: data.tags && data.tags.length > 0 ? data.tags : null }),
      ...(data.birthday !== undefined && { birthday: data.birthday || null }),
    });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Loads visit/order insights for a customer, matched by phone and/or email. */
export async function getCustomerInsightsAction(
  businessId: string,
  contact: { phone?: string | null; email?: string | null },
): Promise<{ data?: CustomerInsights; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const data = await getCustomerInsights(businessId, contact);
    return { data };
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Loads the next page of customers (used by the "טען עוד" button). */
export async function loadMoreCustomersAction(businessId: string, page: number): Promise<{ items: CrmCustomer[]; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { items: [], error: "העסק לא נמצא" };
    return { items: await listCustomers(businessId, { page }) };
  } catch (e) { return { items: [], error: e instanceof Error ? e.message : "שגיאה" }; }
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function createTaskAction(
  businessId: string,
  data: {
    title: string; description?: string; priority?: TaskPriority; due_date?: string;
    leadId?: string | null; customerId?: string | null;
  },
): Promise<Result> {
  await requireUser();
  try {
    const { leadId, customerId, ...fields } = data;
    await createTask(businessId, {
      ...fields, done: false,
      lead_id: leadId ?? null, customer_id: customerId ?? null,
    });
    if (leadId || customerId) {
      await addActivity(businessId, {
        leadId: leadId ?? null,
        customerId: customerId ?? null,
        kind: "task",
        content: `נוצרה משימה: ${data.title}`,
      });
    }
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

export async function toggleTaskAction(businessId: string, id: string, done: boolean): Promise<Result> {
  await requireUser();
  try {
    await updateTask(id, { done });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Snoozes/reschedules a task's due date (used by the inline date picker on My Day task rows). */
export async function rescheduleTaskAction(
  businessId: string,
  id: string,
  dueDate: string | null,
): Promise<Result> {
  await requireUser();
  try {
    if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "תאריך לא תקין" };
    await updateTask(id, { due_date: dueDate });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

export async function deleteTaskAction(businessId: string, id: string): Promise<Result> {
  await requireUser();
  try {
    await deleteTask(id);
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

// ── Deals ──────────────────────────────────────────────────────────────────

export async function createDealAction(
  businessId: string,
  data: { title: string; value?: number; contact_name?: string; notes?: string },
): Promise<Result> {
  await requireUser();
  try {
    await createDeal(businessId, { ...data, stage: "lead" });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

const DEAL_STAGES: DealStage[] = ["lead", "proposal", "negotiation", "won", "lost"];

export async function updateDealStageAction(
  businessId: string, id: string, stage: DealStage,
): Promise<Result> {
  await requireUser();
  if (!DEAL_STAGES.includes(stage)) return { error: "שלב לא חוקי" };
  try {
    await updateDeal(id, { stage });
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

export async function deleteDealAction(businessId: string, id: string): Promise<Result> {
  await requireUser();
  try {
    await deleteDeal(id);
    revalidatePath(crmPath(businessId));
    return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "שגיאה" }; }
}

/** Loads the next page of deals (used by the "טען עוד" button above the kanban board). */
export async function loadMoreDealsAction(businessId: string, page: number): Promise<{ items: CrmDeal[]; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { items: [], error: "העסק לא נמצא" };
    return { items: await listDeals(businessId, { page }) };
  } catch (e) { return { items: [], error: e instanceof Error ? e.message : "שגיאה" }; }
}

// ── Search (global search box + Ctrl+K) ─────────────────────────────────────

export async function crmSearchAction(businessId: string, query: string): Promise<CrmSearchResults & { error?: string }> {
  await requireUser();
  const empty: CrmSearchResults = { leads: [], customers: [], deals: [], tasks: [] };
  try {
    if (!(await getBusiness(businessId))) return { ...empty, error: "העסק לא נמצא" };
    return await searchCrm(businessId, query);
  } catch (e) { return { ...empty, error: e instanceof Error ? e.message : "שגיאה" }; }
}
