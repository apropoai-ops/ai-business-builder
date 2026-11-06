"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import {
  createAutomation,
  updateAutomation,
  deleteAutomation,
  setAutomationEnabled,
  type AutomationTrigger,
  type AutomationAction,
} from "@/lib/services/automations.service";

type Result = { error?: string };

const TRIGGERS: AutomationTrigger[] = ["new_lead", "order_paid", "booking_created", "abandoned_cart"];
const ACTIONS: AutomationAction[] = ["notify_owner", "email_customer", "whatsapp_customer", "create_task"];

function automationsPath(businessId: string) {
  return `/businesses/${businessId}/automations`;
}

async function requireOwner(businessId: string) {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) throw new Error("העסק לא נמצא");
}

export type AutomationInput = {
  name: string;
  trigger: string;
  action: string;
  conditions: { minTotal?: string; source?: string };
  actionConfig: { message?: string; subject?: string; body?: string; title?: string };
};

function buildConditions(raw: AutomationInput["conditions"]): Record<string, unknown> {
  const conditions: Record<string, unknown> = {};
  if (raw.minTotal && raw.minTotal.trim()) {
    const ils = Number(raw.minTotal);
    if (Number.isFinite(ils) && ils > 0) conditions.min_total = Math.round(ils * 100);
  }
  if (raw.source && raw.source.trim()) {
    conditions.source = raw.source.trim();
  }
  return conditions;
}

function buildActionConfig(
  action: AutomationAction,
  raw: AutomationInput["actionConfig"],
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (action === "notify_owner" || action === "whatsapp_customer") {
    if (raw.message?.trim()) config.message = raw.message.trim().slice(0, 500);
  }
  if (action === "email_customer") {
    if (raw.subject?.trim()) config.subject = raw.subject.trim().slice(0, 150);
    if (raw.body?.trim()) config.body = raw.body.trim().slice(0, 2000);
  }
  if (action === "create_task") {
    if (raw.title?.trim()) config.title = raw.title.trim().slice(0, 150);
  }
  return config;
}

export async function createAutomationAction(
  businessId: string,
  input: AutomationInput,
): Promise<Result> {
  try {
    await requireOwner(businessId);

    const name = input.name.trim().slice(0, 120);
    if (!name) return { error: "יש להזין שם לאוטומציה" };
    if (!TRIGGERS.includes(input.trigger as AutomationTrigger)) return { error: "טריגר לא תקין" };
    if (!ACTIONS.includes(input.action as AutomationAction)) return { error: "פעולה לא תקינה" };

    const trigger = input.trigger as AutomationTrigger;
    const action = input.action as AutomationAction;

    await createAutomation(businessId, {
      name,
      trigger,
      conditions: buildConditions(input.conditions),
      action,
      actionConfig: buildActionConfig(action, input.actionConfig),
    });

    revalidatePath(automationsPath(businessId));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function updateAutomationAction(
  businessId: string,
  automationId: string,
  input: AutomationInput,
): Promise<Result> {
  try {
    await requireOwner(businessId);

    const name = input.name.trim().slice(0, 120);
    if (!name) return { error: "יש להזין שם לאוטומציה" };
    if (!TRIGGERS.includes(input.trigger as AutomationTrigger)) return { error: "טריגר לא תקין" };
    if (!ACTIONS.includes(input.action as AutomationAction)) return { error: "פעולה לא תקינה" };

    const trigger = input.trigger as AutomationTrigger;
    const action = input.action as AutomationAction;

    await updateAutomation(automationId, {
      name,
      trigger,
      conditions: buildConditions(input.conditions),
      action,
      actionConfig: buildActionConfig(action, input.actionConfig),
    });

    revalidatePath(automationsPath(businessId));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function toggleAutomationAction(
  businessId: string,
  automationId: string,
  enabled: boolean,
): Promise<Result> {
  try {
    await requireOwner(businessId);
    await setAutomationEnabled(automationId, enabled);
    revalidatePath(automationsPath(businessId));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function deleteAutomationAction(
  businessId: string,
  automationId: string,
): Promise<Result> {
  try {
    await requireOwner(businessId);
    await deleteAutomation(automationId);
    revalidatePath(automationsPath(businessId));
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
