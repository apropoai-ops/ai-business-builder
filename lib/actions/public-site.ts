"use server";

import { escapeHtml } from "@/lib/email-templates";
import { headers } from "next/headers";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/captcha";
import { notifyOwner } from "@/lib/services/email.service";
import { fireAutomations } from "@/lib/services/automations.service";

/** Best-effort client IP for the captcha check — never throws. */
async function requestIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Public lead capture from a published business site (/s/[slug]).
 * Anonymous visitors submit the contact form; the lead lands in the owning
 * business's CRM. Service-role write, strictly scoped: slug must resolve to a
 * PUBLISHED website, and only whitelisted fields are written.
 */
export async function submitPublicLeadAction(
  slug: string,
  input: {
    name: string;
    phone?: string;
    email?: string;
    message?: string;
    /** Honeypot — hidden field; bots fill it, humans never see it. */
    company_website?: string;
    /** Cloudflare Turnstile token — empty/null when the widget isn't configured. */
    captchaToken?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  // Honeypot tripped → pretend success, write nothing.
  if (input.company_website) return { ok: true };

  // Anti-spam: cap submissions per site per hour.
  if (!(await checkRateLimit(`lead:${slug}`, 20, 3600))) {
    return { ok: false, error: "יותר מדי פניות כרגע — נסו שוב מאוחר יותר" };
  }

  if (!(await verifyTurnstileToken(input.captchaToken ?? null, await requestIp()))) {
    return { ok: false, error: "האימות האנושי נכשל — נסו שוב" };
  }

  const name = input.name?.trim().slice(0, 120);
  if (!name || name.length < 2) {
    return { ok: false, error: "נא למלא שם" };
  }
  const phone = input.phone?.trim().slice(0, 40) || null;
  const email = input.email?.trim().slice(0, 160) || null;
  const message = input.message?.trim().slice(0, 1000) || null;

  const supabase = createServiceRoleClient();

  const { data: website } = await supabase
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return { ok: false, error: "האתר אינו זמין" };

  const { error } = await supabase.from("crm_leads").insert({
    business_id: website.business_id,
    name,
    phone,
    email,
    status: "new",
    source: "website",
    notes: message ? `הודעה מהאתר:\n${message}` : null,
  });
  if (error) return { ok: false, error: "שליחה נכשלה — נסו שוב" };

  // Best-effort owner notification + automations — never block the shopper
  // if either fails.
  const detailLines = [
    `<p><b>שם:</b> ${escapeHtml(name)}</p>`,
    phone ? `<p><b>טלפון:</b> ${escapeHtml(phone)}</p>` : "",
    email ? `<p><b>אימייל:</b> ${escapeHtml(email)}</p>` : "",
    message ? `<p><b>הודעה:</b><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : "",
  ]
    .filter(Boolean)
    .join("\n");
  void notifyOwner(website.business_id, "ליד חדש מהאתר", detailLines);
  void fireAutomations(website.business_id, "new_lead", {
    customerName: name,
    customerPhone: phone,
    customerEmail: email,
    source: "website",
  });

  return { ok: true };
}
