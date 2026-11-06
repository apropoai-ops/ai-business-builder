"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { zonedToUtc } from "@/lib/booking-shared";
import {
  createEvent,
  deleteEvent,
  setEventActive,
} from "@/lib/services/events.service";

// ── Owner actions ───────────────────────────────────────────────────────────

export async function saveEventAction(
  businessId: string,
  input: {
    title: string;
    description: string;
    startsAt: string;
    location: string;
    capacity: string;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const title = input.title.trim();
  if (!title) return { error: "נא להזין שם לאירוע" };

  const description = input.description.trim() || null;
  const location = input.location.trim() || null;

  // input.startsAt is a <input type="datetime-local"> value ("2026-08-20T19:00")
  // with NO offset, so `new Date(...)` parses it in the RUNTIME's zone — which
  // is UTC on this server, not Israel. That silently stored every event 2-3
  // hours off (and disagreed with the storefront, which does read it as Israel
  // time). zonedToUtc is the same fix business-events.ts already uses for the
  // identical date+time → timestamp conversion.
  let startsAt: string | null = null;
  if (input.startsAt.trim()) {
    const [datePart, timePart] = input.startsAt.split("T");
    if (!datePart || !timePart) return { error: "תאריך לא תקין" };
    const d = zonedToUtc(datePart, timePart.slice(0, 5));
    if (isNaN(d.getTime())) return { error: "תאריך לא תקין" };
    startsAt = d.toISOString();
  }

  let capacity: number | null = null;
  if (input.capacity.trim()) {
    const c = Math.floor(Number(input.capacity));
    if (isNaN(c) || c <= 0) return { error: "מספר משתתפים לא תקין" };
    capacity = c;
  }

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createEvent(businessId, {
    title,
    description,
    starts_at: startsAt,
    location,
    capacity,
    image_url: imageUrl,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/content`);
  return {};
}

export async function deleteEventAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteEvent(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function toggleEventAction(
  businessId: string,
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setEventActive(id, active);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
