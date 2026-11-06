"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { checkRateLimit } from "@/lib/rate-limit";
import { setReturnStatus, createReturnRequest, listReturns } from "@/lib/services/returns.service";
import { getBusiness } from "@/lib/services/business.service";
import type { Return } from "@/types/database";

// ── Owner actions ───────────────────────────────────────────────────────────

export async function setReturnStatusAction(
  businessId: string,
  id: string,
  status: "new" | "approved" | "rejected" | "done",
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setReturnStatus(id, status);
    revalidatePath(`/businesses/${businessId}/returns`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Loads the next page of returns (used by the "טען עוד" button). */
export async function loadMoreReturnsAction(businessId: string, page: number): Promise<{ items: Return[]; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { items: [], error: "העסק לא נמצא" };
    return { items: await listReturns(businessId, { page }) };
  } catch (e) { return { items: [], error: e instanceof Error ? e.message : "שגיאה" }; }
}

// ── Public actions (anonymous visitors on /s/[slug]) ───────────────────────

export async function submitReturnAction(
  slug: string,
  input: {
    name: string;
    phone: string;
    item?: string;
    reason?: string;
    kind: "return" | "exchange";
    company_website?: string; // honeypot
  },
): Promise<{ ok: boolean; error?: string }> {
  if (input.company_website) return { ok: true }; // bot — pretend success

  if (!(await checkRateLimit(`return:${slug}`, 10, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const name = input.name?.trim().slice(0, 120);
  const phone = input.phone?.trim().slice(0, 40);
  const item = input.item?.trim().slice(0, 200) ?? "";
  const reason = input.reason?.trim().slice(0, 500) ?? "";
  const kind = input.kind === "exchange" ? "exchange" : input.kind === "return" ? "return" : null;

  if (!name || name.length < 2) return { ok: false, error: "נא למלא שם" };
  if (!phone || phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "נא למלא טלפון תקין" };
  }
  if (!kind) return { ok: false, error: "נא לבחור סוג בקשה" };

  return createReturnRequest(slug, {
    name,
    phone,
    item: item || null,
    reason: reason || null,
    kind,
  });
}
