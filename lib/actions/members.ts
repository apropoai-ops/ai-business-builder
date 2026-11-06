"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/services/email.service";
import { emailShell } from "@/lib/email-templates";
import {
  getMemberRole,
  listMembers,
  inviteMember,
  revokeInvite,
  removeMember,
  changeMemberRole,
  type EffectiveRole,
  type InviteEntry,
  type MemberEntry,
  type MemberRole,
} from "@/lib/services/members.service";

const ROLES: MemberRole[] = ["admin", "staff"];

async function assertOwnerOrAdmin(
  businessId: string,
): Promise<{ userId: string; role: EffectiveRole } | { error: string }> {
  const { user } = await requireUser();
  const business = await getBusiness(businessId);
  if (!business) return { error: "העסק לא נמצא" };

  const role = await getMemberRole(businessId, user.id);
  if (role !== "owner" && role !== "admin") {
    return { error: "אין לך הרשאה לנהל את חברי הצוות" };
  }
  return { userId: user.id, role };
}

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "כתובת אימייל לא תקינה";
  }
  return null;
}

export async function listMembersAction(
  businessId: string,
): Promise<{ members: MemberEntry[]; invites: InviteEntry[]; error?: string }> {
  const gate = await assertOwnerOrAdmin(businessId);
  if ("error" in gate) return { members: [], invites: [], error: gate.error };

  try {
    return await listMembers(businessId);
  } catch (e) {
    return {
      members: [],
      invites: [],
      error: e instanceof Error ? e.message : "טעינת חברי הצוות נכשלה",
    };
  }
}

export async function inviteMemberAction(
  businessId: string,
  input: { email: string; role: MemberRole },
): Promise<{ ok: boolean; error?: string }> {
  const gate = await assertOwnerOrAdmin(businessId);
  if ("error" in gate) return { ok: false, error: gate.error };

  const emailError = validateEmail(input.email);
  if (emailError) return { ok: false, error: emailError };
  if (!ROLES.includes(input.role)) return { ok: false, error: "תפקיד לא תקין" };

  if (!(await checkRateLimit(`invite-member:${businessId}`, 20, 3600))) {
    return { ok: false, error: "יותר מדי הזמנות בשעה האחרונה — נסו שוב מאוחר יותר" };
  }

  try {
    const business = await getBusiness(businessId);
    const email = input.email.trim().toLowerCase();
    const { token } = await inviteMember(businessId, email, input.role);

    const link = `https://apropo.business/invite/${token}`;
    const roleLabel = input.role === "admin" ? "מנהל/ת" : "איש/אשת צוות";
    const subject = `הוזמנת להצטרף לצוות של ${business?.name ?? "עסק"} ב-Apropo`;
    const body = `
      <p style="font-size:16px">הוזמנת להצטרף כ<b>${roleLabel}</b> בעסק <b>${business?.name ?? ""}</b> בפלטפורמת Apropo.</p>
      <p>לחצו על הכפתור כדי לאשר את ההזמנה ולהתחבר (או להירשם אם אין לכם עדיין חשבון):</p>
      <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">הצטרפות לצוות</a></p>
      <p style="color:#71717a;font-size:13px">הקישור בתוקף ל-7 ימים. אם לא ציפית להזמנה הזו, אפשר פשוט להתעלם מהמייל.</p>`;
    await sendEmail({ to: email, subject, html: emailShell(subject, body) });

    revalidatePath(`/businesses/${businessId}/members`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שליחת ההזמנה נכשלה" };
  }
}

export async function revokeInviteAction(
  businessId: string,
  inviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await assertOwnerOrAdmin(businessId);
  if ("error" in gate) return { ok: false, error: gate.error };

  try {
    await revokeInvite(businessId, inviteId);
    revalidatePath(`/businesses/${businessId}/members`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ביטול ההזמנה נכשל" };
  }
}

export async function removeMemberAction(
  businessId: string,
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await assertOwnerOrAdmin(businessId);
  if ("error" in gate) return { ok: false, error: gate.error };
  if (memberId === "owner") return { ok: false, error: "לא ניתן להסיר את בעל/ת העסק" };

  try {
    await removeMember(businessId, memberId);
    revalidatePath(`/businesses/${businessId}/members`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ההסרה נכשלה" };
  }
}

export async function changeMemberRoleAction(
  businessId: string,
  memberId: string,
  role: MemberRole,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await assertOwnerOrAdmin(businessId);
  if ("error" in gate) return { ok: false, error: gate.error };
  if (memberId === "owner") return { ok: false, error: "לא ניתן לשנות את תפקיד בעל/ת העסק" };
  if (!ROLES.includes(role)) return { ok: false, error: "תפקיד לא תקין" };

  try {
    await changeMemberRole(businessId, memberId, role);
    revalidatePath(`/businesses/${businessId}/members`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "עדכון התפקיד נכשל" };
  }
}
