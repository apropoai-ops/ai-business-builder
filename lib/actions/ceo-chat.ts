"use server";

import { requireUser } from "@/lib/auth/user";
import { clearMessages } from "@/lib/services/ceo-chat.service";

/**
 * "נקה שיחה" in components/business/ceo-chat.tsx used to be client-only
 * (setMessages([])): the transcript looked cleared, but lib/services/
 * ceo-chat.service.ts's clearMessages() was never called from anywhere, so a
 * reload — or just navigating back to AI CEO — brought every row back from
 * the DB. Worse, the NEXT message posted `history: []` to the model while the
 * DB still held everything, so the AI silently lost context the owner
 * believed was gone. This is the missing server half.
 */
export async function clearCeoChatAction(businessId: string): Promise<{ error?: string }> {
  await requireUser();
  try {
    await clearMessages(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הניקוי נכשל" };
  }
}
