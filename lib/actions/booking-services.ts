"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import {
  ALLOWED_DURATIONS,
  listBookingServices,
  createBookingService,
  updateBookingService,
  deleteBookingService,
  importLegacyServices,
} from "@/lib/services/booking-services.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import type { BookingService } from "@/types/database";

/** Shared validation for name/duration/price — used by both create + update. */
function validateFields(input: { name: string; duration_minutes: number; price: number | null }): string | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return "שם השירות חייב להיות בין 2 ל-80 תווים";
  if (!ALLOWED_DURATIONS.includes(input.duration_minutes as (typeof ALLOWED_DURATIONS)[number])) {
    return "משך זמן לא תקין";
  }
  if (input.price !== null && (!Number.isFinite(input.price) || input.price < 0)) {
    return "מחיר לא תקין";
  }
  return null;
}

async function assertOwnerAndFeature(businessId: string): Promise<{ error?: string }> {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) return { error: "העסק לא נמצא" };
  const plan = await getPlanForBusiness(businessId);
  assertFeature(plan, "bookings");
  return {};
}

export async function listBookingServicesAction(
  businessId: string,
): Promise<{ services?: BookingService[]; error?: string }> {
  await requireUser();
  try {
    const services = await listBookingServices(businessId);
    return { services };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "טעינת השירותים נכשלה" };
  }
}

export async function createBookingServiceAction(
  businessId: string,
  input: { name: string; description?: string | null; duration_minutes: number; price: number | null },
): Promise<{ error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return gate;
    const err = validateFields(input);
    if (err) return { error: err };

    await createBookingService(businessId, {
      name: input.name.trim(),
      description: input.description?.trim().slice(0, 300) || null,
      duration_minutes: input.duration_minutes,
      price: input.price,
      active: true,
    });
    revalidatePath(`/businesses/${businessId}/bookings`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function updateBookingServiceAction(
  businessId: string,
  serviceId: string,
  input: { name: string; description?: string | null; duration_minutes: number; price: number | null; active: boolean },
): Promise<{ error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return gate;
    const err = validateFields(input);
    if (err) return { error: err };

    await updateBookingService(serviceId, {
      name: input.name.trim(),
      description: input.description?.trim().slice(0, 300) || null,
      duration_minutes: input.duration_minutes,
      price: input.price,
      active: input.active,
    });
    revalidatePath(`/businesses/${businessId}/bookings`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "העדכון נכשל" };
  }
}

export async function deleteBookingServiceAction(
  businessId: string,
  serviceId: string,
): Promise<{ error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return gate;
    await deleteBookingService(serviceId);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

/** One-click migration from the legacy JSON service-name list. */
export async function importLegacyServicesAction(
  businessId: string,
): Promise<{ imported?: number; error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return gate;
    const imported = await importLegacyServices(businessId);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { imported };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הייבוא נכשל" };
  }
}
