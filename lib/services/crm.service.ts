import { createClient } from "@/lib/supabase/server";
import type {
  CrmLead, CrmCustomer, CrmTask, CrmDeal, CrmActivity,
  Booking,
  TablesInsert, TablesUpdate,
} from "@/types/database";
import { zonedToUtc, addDaysToDateStr } from "@/lib/booking-shared";
import { normalizePhoneForWhatsapp } from "@/lib/phone";
import { toRange } from "@/lib/services/pagination";

/** Standard page size for the leads/customers/deals "טען עוד" pagination. */
export const CRM_PAGE_SIZE = 50;

/**
 * Normalizes a phone number to E.164 (leading `+`) for storage, so the same
 * contact always matches regardless of how it was typed. Falls back to the
 * trimmed original when it can't be normalized (too short) — never throws,
 * never silently drops data.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = normalizePhoneForWhatsapp(trimmed);
  return digits ? `+${digits}` : trimmed;
}

function normalizePhoneField<T extends { phone?: string | null }>(input: T): T {
  if (input.phone === undefined) return input;
  return { ...input, phone: normalizePhoneE164(input.phone) };
}

// ── Leads ────────────────────────────────────────────────────────────────────

/** Latest leads, newest first, paged ~CRM_PAGE_SIZE at a time. */
export async function listLeads(businessId: string, opts?: { page?: number }): Promise<CrmLead[]> {
  const [from, to] = toRange(opts?.page ?? 1, CRM_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_leads").select("*").eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Finds an existing lead with the same normalized phone (for the duplicate-phone warning). */
export async function findLeadByPhone(businessId: string, phoneE164: string): Promise<CrmLead | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_leads").select("*").eq("business_id", businessId).eq("phone", phoneE164)
    .limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function createLead(
  businessId: string,
  input: Omit<TablesInsert<"crm_leads">, "business_id">,
): Promise<CrmLead> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_leads").insert({ ...normalizePhoneField(input), business_id: businessId })
    .select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create lead");
  return data;
}

export async function updateLead(id: string, fields: TablesUpdate<"crm_leads">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_leads").update(normalizePhoneField(fields)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLead(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Customers ────────────────────────────────────────────────────────────────

/** Latest customers, newest first, paged ~CRM_PAGE_SIZE at a time. */
export async function listCustomers(businessId: string, opts?: { page?: number }): Promise<CrmCustomer[]> {
  const [from, to] = toRange(opts?.page ?? 1, CRM_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_customers").select("*").eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCustomer(
  businessId: string,
  input: Omit<TablesInsert<"crm_customers">, "business_id">,
): Promise<CrmCustomer> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_customers").insert({ ...normalizePhoneField(input), business_id: businessId })
    .select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create customer");
  return data;
}

export async function updateCustomer(id: string, fields: TablesUpdate<"crm_customers">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_customers").update(normalizePhoneField(fields)).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Focused helper for replacing a customer's tag list (used by the tag editor / quick chips). */
export async function setCustomerTags(id: string, tags: string[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_customers").update({ tags }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(businessId: string): Promise<CrmTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_tasks").select("*").eq("business_id", businessId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTask(
  businessId: string,
  input: Omit<TablesInsert<"crm_tasks">, "business_id">,
): Promise<CrmTask> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_tasks").insert({ ...input, business_id: businessId })
    .select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create task");
  return data;
}

export async function updateTask(id: string, fields: TablesUpdate<"crm_tasks">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Deals ────────────────────────────────────────────────────────────────────

/** Latest deals, newest first, paged ~CRM_PAGE_SIZE at a time (kanban board keeps loading more via "טען עוד"). */
export async function listDeals(businessId: string, opts?: { page?: number }): Promise<CrmDeal[]> {
  const [from, to] = toRange(opts?.page ?? 1, CRM_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_deals").select("*").eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDeal(
  businessId: string,
  input: Omit<TablesInsert<"crm_deals">, "business_id">,
): Promise<CrmDeal> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_deals").insert({ ...input, business_id: businessId })
    .select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create deal");
  return data;
}

export async function updateDeal(id: string, fields: TablesUpdate<"crm_deals">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_deals").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteDeal(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Activities (unified timeline for leads/customers) ───────────────────────

/** Paged activity timeline (newest first) — pass `page` to load further back than the first CRM_PAGE_SIZE. */
export async function listActivities(
  businessId: string,
  target: { leadId?: string; customerId?: string },
  opts?: { page?: number },
): Promise<CrmActivity[]> {
  const filters: string[] = [];
  if (target.leadId) filters.push(`lead_id.eq.${target.leadId}`);
  if (target.customerId) filters.push(`customer_id.eq.${target.customerId}`);
  if (filters.length === 0) return [];

  const [from, to] = toRange(opts?.page ?? 1, CRM_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_activities").select("*")
    .eq("business_id", businessId)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addActivity(
  businessId: string,
  input: {
    leadId?: string | null;
    customerId?: string | null;
    kind: "note" | "status" | "task" | "system";
    content: string;
  },
): Promise<CrmActivity> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_activities")
    .insert({
      business_id: businessId,
      lead_id: input.leadId ?? null,
      customer_id: input.customerId ?? null,
      kind: input.kind,
      content: input.content,
    })
    .select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add activity");
  return data;
}

/** Edits a note's content — restricted to `kind = 'note'` so status/task/system log entries stay tamper-proof. */
export async function updateActivityContent(businessId: string, id: string, content: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_activities").update({ content })
    .eq("id", id).eq("business_id", businessId).eq("kind", "note");
  if (error) throw new Error(error.message);
}

/** Deletes a note — restricted to `kind = 'note'` (see updateActivityContent). */
export async function deleteActivity(businessId: string, id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_activities").delete()
    .eq("id", id).eq("business_id", businessId).eq("kind", "note");
  if (error) throw new Error(error.message);
}

// ── Search (global search box + Ctrl+K) ──────────────────────────────────────

export type CrmSearchResults = {
  leads: CrmLead[];
  customers: CrmCustomer[];
  deals: CrmDeal[];
  tasks: CrmTask[];
};

/** Strips characters that would break a `.or(...)`/`ilike` filter string. */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%_,()]/g, " ").trim();
}

/** Server-side search across leads/customers/deals/tasks, capped per-entity — powers the CRM global search (Ctrl+K). */
export async function searchCrm(businessId: string, query: string): Promise<CrmSearchResults> {
  const term = sanitizeSearchTerm(query);
  if (term.length < 2) return { leads: [], customers: [], deals: [], tasks: [] };
  const like = `%${term}%`;
  // Phone numbers are stored E.164-normalized (e.g. "050-1234567" -> "+972501234567"),
  // so a plain substring match against the user's raw local-format input misses —
  // also try the normalized form so searches for "0501234567" still find it.
  const normalizedPhone = normalizePhoneE164(term);
  const phoneLike = normalizedPhone && normalizedPhone !== term ? `%${normalizedPhone}%` : null;
  const phoneFilter = phoneLike ? `phone.ilike.${like},phone.ilike.${phoneLike}` : `phone.ilike.${like}`;

  const supabase = await createClient();
  const [leadsRes, customersRes, dealsRes, tasksRes] = await Promise.all([
    supabase.from("crm_leads").select("*").eq("business_id", businessId)
      .or(`name.ilike.${like},${phoneFilter},email.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("crm_customers").select("*").eq("business_id", businessId)
      .or(`name.ilike.${like},${phoneFilter},email.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("crm_deals").select("*").eq("business_id", businessId)
      .or(`title.ilike.${like},contact_name.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("crm_tasks").select("*").eq("business_id", businessId)
      .or(`title.ilike.${like},description.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(8),
  ]);
  if (leadsRes.error) throw new Error(leadsRes.error.message);
  if (customersRes.error) throw new Error(customersRes.error.message);
  if (dealsRes.error) throw new Error(dealsRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);

  return {
    leads: leadsRes.data ?? [],
    customers: customersRes.data ?? [],
    deals: dealsRes.data ?? [],
    tasks: tasksRes.data ?? [],
  };
}

// ── Focus ("what needs attention today") ─────────────────────────────────────

/** The only fields the "My Day" birthday card renders — see BirthdayRow in today-view.tsx. */
export type BirthdayCustomer = Pick<CrmCustomer, "id" | "name" | "phone" | "birthday">;

export type CrmFocus = {
  overdueTasks: CrmTask[];
  todayTasks: CrmTask[];
  staleLeads: CrmLead[];
  todayBookings: Booking[];
  upcomingBirthdays: BirthdayCustomer[];
};

/** Today's date (YYYY-MM-DD) in Israel time. */
function israelToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/** Days from `todayStr` (YYYY-MM-DD) until the next occurrence of `birthday`'s month/day (0–365). */
function daysUntilNextBirthday(birthday: string, todayStr: string): number {
  const [, bmStr, bdStr] = birthday.split("-");
  const [tyStr, tmStr, tdStr] = todayStr.split("-");
  const bm = Number(bmStr), bd = Number(bdStr);
  const ty = Number(tyStr), tm = Number(tmStr), td = Number(tdStr);
  const todayUTC = Date.UTC(ty, tm - 1, td);
  let next = Date.UTC(ty, bm - 1, bd);
  if (next < todayUTC) next = Date.UTC(ty + 1, bm - 1, bd);
  return Math.round((next - todayUTC) / 86400_000);
}

/**
 * Aggregates the CRM "focus" for a business's overview: overdue/today's
 * tasks, leads without a scheduled next follow-up, today's bookings, and
 * customers with a birthday in the next week. Owner-RLS client — callers
 * must already have verified the caller owns `businessId`.
 *
 * overdueTasks/staleLeads are capped generously (100, not the old hard 15)
 * — the "My Day" view itself truncates the on-screen list with a "הצג עוד"
 * reveal instead of silently dropping data past a fixed count.
 */
export async function getCrmFocus(businessId: string): Promise<CrmFocus> {
  const today = israelToday();
  const dayStartIso = zonedToUtc(today, "00:00").toISOString();
  const dayEndIso = zonedToUtc(addDaysToDateStr(today, 1), "00:00").toISOString();

  const supabase = await createClient();

  const [overdueRes, todayRes, staleLeadsRes, bookingsRes, birthdayRes] = await Promise.all([
    supabase
      .from("crm_tasks").select("*")
      .eq("business_id", businessId)
      .eq("done", false)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(100),
    supabase
      .from("crm_tasks").select("*")
      .eq("business_id", businessId)
      .eq("done", false)
      .eq("due_date", today),
    supabase
      .from("crm_leads").select("*")
      .eq("business_id", businessId)
      .in("status", ["new", "contacted"])
      .or(`next_follow_up_at.is.null,next_follow_up_at.lte.${today}`)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("bookings").select("*")
      .eq("business_id", businessId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", dayStartIso)
      .lt("starts_at", dayEndIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("crm_customers").select("id, name, phone, birthday")
      .eq("business_id", businessId)
      .not("birthday", "is", null)
      .limit(500),
  ]);

  if (overdueRes.error) throw new Error(overdueRes.error.message);
  if (todayRes.error) throw new Error(todayRes.error.message);
  if (staleLeadsRes.error) throw new Error(staleLeadsRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (birthdayRes.error) throw new Error(birthdayRes.error.message);

  const upcomingBirthdays = (birthdayRes.data ?? [])
    .filter((c) => c.birthday && daysUntilNextBirthday(c.birthday, today) <= 7)
    .sort((a, b) => daysUntilNextBirthday(a.birthday!, today) - daysUntilNextBirthday(b.birthday!, today));

  return {
    overdueTasks: overdueRes.data ?? [],
    todayTasks: todayRes.data ?? [],
    staleLeads: staleLeadsRes.data ?? [],
    todayBookings: bookingsRes.data ?? [],
    upcomingBirthdays,
  };
}
