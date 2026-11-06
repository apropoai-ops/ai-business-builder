"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createTeamMember,
  deleteTeamMember,
} from "@/lib/services/team.service";

export async function saveTeamMemberAction(
  businessId: string,
  input: { name: string; role: string; photoUrl: string; bio: string },
): Promise<{ error?: string }> {
  await requireUser();
  const name = input.name.trim();
  if (!name) return { error: "נא להזין שם" };

  const res = await createTeamMember(businessId, {
    name,
    role: input.role.trim() || null,
    photo_url: input.photoUrl.trim() || null,
    bio: input.bio.trim() || null,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/content`);
  return {};
}

export async function deleteTeamMemberAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteTeamMember(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
