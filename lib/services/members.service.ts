import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Business team members — invites, roles, removal. Uses the service-role
 * client throughout: mutations are gated by explicit role checks in
 * lib/actions/members.ts (the trusted caller), and reads need
 * auth.admin.getUserById to resolve member emails, which the anon/RLS client
 * cannot do.
 */

export type MemberRole = "admin" | "staff";
export type EffectiveRole = "owner" | MemberRole;

export type MemberEntry = {
  /** business_members.id, or the literal "owner" for the synthesized owner row. */
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  role: EffectiveRole;
  status: string;
  isOwner: boolean;
  createdAt: string;
};

export type InviteEntry = {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  expiresAt: string;
  createdAt: string;
};

/**
 * The caller's effective role for a business: 'owner' (businesses.owner_id),
 * an active member's role, or null if they have no access at all.
 */
export async function getMemberRole(
  businessId: string,
  userId: string,
): Promise<EffectiveRole | null> {
  const s = createServiceRoleClient();
  const { data: biz } = await s
    .from("businesses")
    .select("owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return null;
  if (biz.owner_id === userId) return "owner";

  const { data: member } = await s
    .from("business_members")
    .select("role,status")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member && member.status === "active") return member.role as MemberRole;
  return null;
}

/** Lists the owner (synthesized) + real team members, plus pending invites. */
export async function listMembers(
  businessId: string,
): Promise<{ members: MemberEntry[]; invites: InviteEntry[] }> {
  const s = createServiceRoleClient();
  const [{ data: biz }, { data: rows }, { data: invites }] = await Promise.all([
    s.from("businesses").select("owner_id,created_at").eq("id", businessId).maybeSingle(),
    s
      .from("business_members")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    s
      .from("business_member_invites")
      .select("*")
      .eq("business_id", businessId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const members: MemberEntry[] = [];

  if (biz?.owner_id) {
    const { data: ownerUser } = await s.auth.admin.getUserById(biz.owner_id);
    members.push({
      id: "owner",
      userId: biz.owner_id,
      email: ownerUser?.user?.email ?? null,
      fullName:
        (ownerUser?.user?.user_metadata?.full_name as string | undefined) ?? null,
      role: "owner",
      status: "active",
      isOwner: true,
      createdAt: biz.created_at,
    });
  }

  for (const m of rows ?? []) {
    const { data: u } = await s.auth.admin.getUserById(m.user_id);
    members.push({
      id: m.id,
      userId: m.user_id,
      email: u?.user?.email ?? null,
      fullName: (u?.user?.user_metadata?.full_name as string | undefined) ?? null,
      role: m.role as MemberRole,
      status: m.status,
      isOwner: false,
      createdAt: m.created_at,
    });
  }

  const now = Date.now();
  const activeInvites: InviteEntry[] = (invites ?? [])
    .filter((i) => new Date(i.expires_at).getTime() > now)
    .map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role as MemberRole,
      token: i.token,
      expiresAt: i.expires_at,
      createdAt: i.created_at,
    }));

  return { members, invites: activeInvites };
}

/** Creates a pending invite and returns its token (caller sends the email). */
export async function inviteMember(
  businessId: string,
  email: string,
  role: MemberRole,
): Promise<{ token: string }> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("business_member_invites")
    .insert({ business_id: businessId, email, role })
    .select("token")
    .single();
  if (error || !data) throw new Error("שליחת ההזמנה נכשלה");
  return { token: data.token };
}

export async function revokeInvite(businessId: string, inviteId: string): Promise<void> {
  const s = createServiceRoleClient();
  const { error } = await s
    .from("business_member_invites")
    .delete()
    .eq("id", inviteId)
    .eq("business_id", businessId);
  if (error) throw new Error("ביטול ההזמנה נכשל");
}

export async function removeMember(businessId: string, memberId: string): Promise<void> {
  const s = createServiceRoleClient();
  const { error } = await s
    .from("business_members")
    .delete()
    .eq("id", memberId)
    .eq("business_id", businessId);
  if (error) throw new Error("ההסרה נכשלה");
}

export async function changeMemberRole(
  businessId: string,
  memberId: string,
  role: MemberRole,
): Promise<void> {
  const s = createServiceRoleClient();
  const { error } = await s
    .from("business_members")
    .update({ role })
    .eq("id", memberId)
    .eq("business_id", businessId);
  if (error) throw new Error("עדכון התפקיד נכשל");
}

/**
 * Validates + consumes an invite token, creating (or reactivating) the
 * membership for the accepting user. Uses the service-role client on purpose:
 * the accepting user isn't a member yet, so the normal RLS-scoped client
 * can't see the invite row or insert into business_members. The token is an
 * unguessable UUID and expiry/accepted-state are checked explicitly, matching
 * the capability-token pattern used elsewhere in the app (cancel tokens etc).
 */
export async function acceptInvite(
  token: string,
  userId: string,
  userEmail?: string | null,
): Promise<{ ok: boolean; businessId?: string; error?: string }> {
  const s = createServiceRoleClient();
  const { data: invite } = await s
    .from("business_member_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { ok: false, error: "ההזמנה לא נמצאה או שכבר בוטלה" };
  if (invite.accepted_at) return { ok: false, error: "ההזמנה כבר נוצלה" };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "תוקף ההזמנה פג — בקשו הזמנה חדשה" };
  }
  if (
    !userEmail ||
    userEmail.trim().toLowerCase() !== invite.email.trim().toLowerCase()
  ) {
    return {
      ok: false,
      error: `ההזמנה נשלחה לכתובת ${invite.email} — יש להתחבר עם המייל שהוזמן`,
    };
  }

  const { error: upsertError } = await s.from("business_members").upsert(
    {
      business_id: invite.business_id,
      user_id: userId,
      role: invite.role,
      status: "active",
    },
    { onConflict: "business_id,user_id" },
  );
  if (upsertError) return { ok: false, error: "ההצטרפות לצוות נכשלה" };

  await s
    .from("business_member_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return { ok: true, businessId: invite.business_id };
}
