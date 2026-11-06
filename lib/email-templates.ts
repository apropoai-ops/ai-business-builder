import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/types/database";

/**
 * Pure email-template builders — no side effects and no next/supabase imports,
 * so they're unit-testable in isolation (the email *sending* lives in
 * lib/services/email.service.ts, which pulls server-only deps).
 */

/** Wraps body content in a simple branded, RTL HTML shell. */
/** Escapes HTML-significant characters before embedding untrusted text into an email body. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `title` is plain text (it is usually the subject line) and is escaped here. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f4f4f5;font-family:system-ui,Segoe UI,Arial,sans-serif">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7">
<div style="background:#4f46e5;color:#fff;padding:16px 24px;font-weight:700;font-size:16px">${escapeHtml(title)}</div>
<div style="padding:24px;color:#27272a;font-size:14px;line-height:1.6">${bodyHtml}</div>
<div style="padding:12px 24px;color:#a1a1aa;font-size:11px;border-top:1px solid #f4f4f5">נשלח אוטומטית מ-AI Business Builder</div>
</div></body></html>`;
}

/**
 * Subject + branded HTML for the subscription welcome email. Returns null for
 * an unknown tier so callers can simply skip sending. Lists the plan's features
 * so the new subscriber immediately sees what they unlocked.
 */
export function buildPlanWelcomeEmail(
  tier: PlanTier,
): { subject: string; html: string } | null {
  const plan = PLANS[tier];
  if (!plan) return null;
  const features = plan.features
    .map((f) => `<li style="margin:6px 0">${f}</li>`)
    .join("");
  const body = `
      <p style="font-size:18px;font-weight:700;margin:0 0 10px">ברוכים הבאים ל-AI Business Builder! 🎉</p>
      <p style="margin:0 0 12px">תודה שהצטרפת לחבילת <strong>${plan.name}</strong> — אנחנו נרגשים ללוות אותך בבניית העסק שלך.</p>
      <p style="margin:0 0 6px;font-weight:600">מה נפתח עבורך בחבילה:</p>
      <ul style="padding-right:20px;margin:8px 0">${features}</ul>
      <p style="margin:16px 0 0">אפשר להתחיל כבר עכשיו — כל הכלים מחכים לך במערכת. בהצלחה! 🚀</p>`;
  return {
    subject: `ברוכים הבאים לחבילת ${plan.name} 🎉`,
    html: emailShell("הצטרפת בהצלחה!", body),
  };
}
