"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  issueGiftCard,
  deactivateGiftCard,
} from "@/lib/services/gift-cards.service";
import type { GiftCard } from "@/types/database";

export async function issueGiftCardAction(
  businessId: string,
  input: { amount: string; recipientName?: string },
): Promise<{ error?: string; card?: GiftCard }> {
  await requireUser();

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "סכום לא תקין" };
  }

  const res = await issueGiftCard(businessId, {
    amount,
    recipient_name: input.recipientName?.trim() || null,
  });
  if (res.error) return { error: res.error };

  revalidatePath(`/businesses/${businessId}/content`);
  return { card: res.card };
}

export async function deactivateGiftCardAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deactivateGiftCard(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השבתת השובר נכשלה" };
  }
}
