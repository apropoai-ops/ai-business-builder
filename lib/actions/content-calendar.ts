"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  setCalendarEntryStatus,
  deleteCalendarEntry,
} from "@/lib/services/content-calendar.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";

function path(businessId: string) {
  return `/businesses/${businessId}/calendar`;
}

export async function toggleCalendarEntryAction(
  businessId: string,
  entryId: string,
  status: string,
): Promise<void> {
  await requireUser();
  const plan = await getPlanForBusiness(businessId);
  assertFeature(plan, "content_calendar");
  await setCalendarEntryStatus(entryId, status);
  revalidatePath(path(businessId));
}

export async function deleteCalendarEntryAction(
  businessId: string,
  entryId: string,
): Promise<void> {
  await requireUser();
  const plan = await getPlanForBusiness(businessId);
  assertFeature(plan, "content_calendar");
  await deleteCalendarEntry(entryId);
  revalidatePath(path(businessId));
}
