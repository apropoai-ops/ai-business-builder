import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { openWhatsappSecret } from "@/lib/whatsapp-secrets";
import { sendPushToBusinessOwner } from "@/lib/services/push.service";
import { notifyOwner, sendEmail, emailConfigured } from "@/lib/services/email.service";
import { sendWhatsappText } from "@/lib/services/whatsapp-api";
import type { Automation, AutomationRun, Database, Json, WhatsappConfig } from "@/types/database";

/**
 * Automations rules engine — "when X happens, do Y" rules the owner
 * configures per business (see 0068_automations.sql). Fired from webhook /
 * server-action / cron contexts alike (no guaranteed session), so this uses
 * the service-role client the same way lib/services/whatsapp-webhook.service.ts
 * does, scoping every query explicitly by business_id.
 *
 * fireAutomations is the ONLY export other packages should import — it is a
 * locked cross-package contract (see AGENTS.md): fire-and-forget, NEVER
 * throws, no-op when no automations are configured for the trigger.
 */

export type AutomationTrigger =
  | "new_lead"
  | "order_paid"
  | "booking_created"
  | "abandoned_cart";

export type AutomationAction =
  | "notify_owner"
  | "email_customer"
  | "whatsapp_customer"
  | "create_task";

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  new_lead: "ליד חדש",
  order_paid: "הזמנה שולמה",
  booking_created: "תור נקבע",
  abandoned_cart: "עגלה ננטשה",
};

const DEFAULT_OWNER_MESSAGE: Record<AutomationTrigger, string> = {
  new_lead: "התקבל ליד חדש: {{customerName}}",
  order_paid: "התקבלה הזמנה חדשה בסך {{total}} מאת {{customerName}}",
  booking_created: "נקבע תור חדש עבור {{customerName}}",
  abandoned_cart: "עגלה ננטשה בסך {{total}} מאת {{customerName}}",
};

const DEFAULT_TASK_TITLE: Record<AutomationTrigger, string> = {
  new_lead: "ליצור קשר עם ליד חדש",
  order_paid: "לטפל בהזמנה חדשה",
  booking_created: "להתכונן לתור שנקבע",
  abandoned_cart: "לחזור ללקוח עם עגלה נטושה",
};

/**
 * Replaces {{key}} placeholders in a template string with values from the
 * payload (agorot amounts under the "total" key are formatted as ₪).
 */
export function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    if (key === "total" && typeof payload.total === "number") {
      return `₪${(payload.total / 100).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const value = payload[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

/** Escapes HTML-significant characters before embedding interpolated text into an HTML email body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Empty conditions object always passes. Supported keys per the spec. */
export function conditionsPass(
  trigger: AutomationTrigger,
  conditions: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  if (trigger === "order_paid" && conditions.min_total != null) {
    const min = Number(conditions.min_total);
    const total = Number(payload.total);
    if (Number.isFinite(min) && (!Number.isFinite(total) || total < min)) return false;
  }

  if (trigger === "new_lead" && conditions.source) {
    const wantedSource = String(conditions.source).trim().toLowerCase();
    const actualSource = String(payload.source ?? "").trim().toLowerCase();
    if (wantedSource && wantedSource !== actualSource) return false;
  }

  return true;
}

async function runNotifyOwner(
  businessId: string,
  trigger: AutomationTrigger,
  actionConfig: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const template =
    typeof actionConfig.message === "string" && actionConfig.message.trim()
      ? actionConfig.message
      : DEFAULT_OWNER_MESSAGE[trigger];
  const message = interpolate(template, payload);

  await Promise.all([
    sendPushToBusinessOwner(businessId, {
      title: "התראת אוטומציה",
      body: message,
    }),
    notifyOwner(businessId, `התראה — ${TRIGGER_LABELS[trigger]}`, `<p>${escapeHtml(message)}</p>`),
  ]);

  return `נשלחה התראה לבעל העסק: ${message}`;
}

async function runEmailCustomer(
  actionConfig: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const to = typeof payload.customerEmail === "string" ? payload.customerEmail.trim() : "";
  if (!to) return "דולג — ללקוח אין כתובת אימייל";
  if (!emailConfigured()) return "דולג — שליחת אימייל אינה מוגדרת";

  const subjectTemplate =
    typeof actionConfig.subject === "string" && actionConfig.subject.trim()
      ? actionConfig.subject
      : "עדכון מאיתנו";
  const bodyTemplate =
    typeof actionConfig.body === "string" && actionConfig.body.trim()
      ? actionConfig.body
      : "תודה שאתם איתנו!";

  const subject = interpolate(subjectTemplate, payload);
  const body = interpolate(bodyTemplate, payload);

  const res = await sendEmail({ to, subject, html: `<p>${escapeHtml(body)}</p>` });
  if (!res.ok) return `שליחת האימייל נכשלה: ${res.error ?? "שגיאה לא ידועה"}`;
  return `נשלח מייל ללקוח (${to})`;
}

async function runWhatsappCustomer(
  businessId: string,
  actionConfig: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const to = typeof payload.customerPhone === "string" ? payload.customerPhone.trim() : "";
  if (!to) return "דולג — ללקוח אין מספר טלפון";

  const supabase = createServiceRoleClient();
  const { data: config } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("business_id", businessId)
    .eq("connected", true)
    .maybeSingle<WhatsappConfig>();

  if (!config?.phone_number_id || !config?.access_token) {
    return "דולג — וואטסאפ אינו מחובר לעסק";
  }

  const bodyTemplate =
    typeof actionConfig.message === "string" && actionConfig.message.trim()
      ? actionConfig.message
      : "תודה שאתם איתנו!";
  const body = interpolate(bodyTemplate, payload);

  const res = await sendWhatsappText({
    phoneNumberId: config.phone_number_id,
    accessToken: openWhatsappSecret(config.access_token) ?? "",
    to,
    body,
  });

  if (!res.ok) return `שליחת הוואטסאפ נכשלה: ${res.error ?? "שגיאה לא ידועה"}`;
  return `נשלחה הודעת וואטסאפ ללקוח (${to})`;
}

async function runCreateTask(
  businessId: string,
  trigger: AutomationTrigger,
  actionConfig: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const titleTemplate =
    typeof actionConfig.title === "string" && actionConfig.title.trim()
      ? actionConfig.title
      : DEFAULT_TASK_TITLE[trigger];
  const title = interpolate(titleTemplate, payload);
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("crm_tasks").insert({
    business_id: businessId,
    title,
    description: `נוצר אוטומטית מהאוטומציה "${TRIGGER_LABELS[trigger]}"`,
    due_date: today,
  });

  if (error) return `יצירת המשימה נכשלה: ${error.message}`;
  return `נוצרה משימה: ${title}`;
}

// ── Owner CRUD (RLS-enforced, used by the dashboard page/actions) ──────────

export async function listAutomations(businessId: string): Promise<Automation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automations")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listAutomationRuns(businessId: string, limit = 50): Promise<AutomationRun[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function createAutomation(
  businessId: string,
  input: {
    name: string;
    trigger: AutomationTrigger;
    conditions: Record<string, unknown>;
    action: AutomationAction;
    actionConfig: Record<string, unknown>;
    enabled?: boolean;
  },
): Promise<Automation> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automations")
    .insert({
      business_id: businessId,
      name: input.name,
      trigger: input.trigger,
      conditions: input.conditions as Json,
      action: input.action,
      action_config: input.actionConfig as Json,
      enabled: input.enabled ?? true,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "יצירת האוטומציה נכשלה");
  return data;
}

export async function updateAutomation(
  automationId: string,
  input: {
    name?: string;
    trigger?: AutomationTrigger;
    conditions?: Record<string, unknown>;
    action?: AutomationAction;
    actionConfig?: Record<string, unknown>;
    enabled?: boolean;
  },
): Promise<void> {
  const supabase = await createClient();
  const patch: Database["public"]["Tables"]["automations"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.trigger !== undefined) patch.trigger = input.trigger;
  if (input.conditions !== undefined) patch.conditions = input.conditions as Json;
  if (input.action !== undefined) patch.action = input.action;
  if (input.actionConfig !== undefined) patch.action_config = input.actionConfig as Json;
  if (input.enabled !== undefined) patch.enabled = input.enabled;

  const { error } = await supabase.from("automations").update(patch).eq("id", automationId);
  if (error) throw new Error(error.message);
}

export async function setAutomationEnabled(automationId: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("automations").update({ enabled }).eq("id", automationId);
  if (error) throw new Error(error.message);
}

export async function deleteAutomation(automationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("automations").delete().eq("id", automationId);
  if (error) throw new Error(error.message);
}

/**
 * Loads enabled automations for (businessId, trigger), evaluates each rule's
 * conditions, executes matching actions and logs the outcome. Never throws —
 * every step is wrapped so a broken rule can't break the caller's flow.
 */
export async function fireAutomations(
  businessId: string,
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data: automations } = await supabase
      .from("automations")
      .select("*")
      .eq("business_id", businessId)
      .eq("trigger", trigger)
      .eq("enabled", true);

    const rules = (automations ?? []) as Automation[];
    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        const conditions = (rule.conditions ?? {}) as Record<string, unknown>;
        if (!conditionsPass(trigger, conditions, payload)) continue;

        const actionConfig = (rule.action_config ?? {}) as Record<string, unknown>;
        let detail = "";

        try {
          switch (rule.action as AutomationAction) {
            case "notify_owner":
              detail = await runNotifyOwner(businessId, trigger, actionConfig, payload);
              break;
            case "email_customer":
              detail = await runEmailCustomer(actionConfig, payload);
              break;
            case "whatsapp_customer":
              detail = await runWhatsappCustomer(businessId, actionConfig, payload);
              break;
            case "create_task":
              detail = await runCreateTask(businessId, trigger, actionConfig, payload);
              break;
            default:
              detail = "פעולה לא מוכרת";
          }

          await supabase.from("automation_runs").insert({
            automation_id: rule.id,
            business_id: businessId,
            trigger,
            status: "ok",
            detail,
          });
        } catch (actionError) {
          await supabase.from("automation_runs").insert({
            automation_id: rule.id,
            business_id: businessId,
            trigger,
            status: "failed",
            detail: actionError instanceof Error ? actionError.message : "שגיאה לא ידועה",
          });
        }
      } catch {
        // A single broken rule must never stop the others.
      }
    }
  } catch {
    // fireAutomations must never throw.
  }
}
