"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import {
  listBookingStaff,
  createBookingStaff,
  updateBookingStaff,
  deleteBookingStaff,
  listStaffServices,
  setStaffServices,
} from "@/lib/services/booking-staff.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import type { WeeklyHours } from "@/lib/booking-shared";
import type { BookingStaff } from "@/types/database";

async function assertOwnerAndFeature(businessId: string): Promise<{ error?: string }> {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) return { error: "העסק לא נמצא" };
  const plan = await getPlanForBusiness(businessId);
  assertFeature(plan, "bookings");
  return {};
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return "שם איש הצוות חייב להיות בין 2 ל-80 תווים";
  return null;
}

export async function listBookingStaffAction(
  businessId: string,
): Promise<{ staff: BookingStaff[]; staffServices: Record<string, string[]>; error?: string }> {
  await requireUser();
  try {
    const [staff, staffServices] = await Promise.all([
      listBookingStaff(businessId),
      listStaffServices(businessId),
    ]);
    return { staff, staffServices };
  } catch (e) {
    return { staff: [], staffServices: {}, error: e instanceof Error ? e.message : "טעינת אנשי הצוות נכשלה" };
  }
}

export async function createBookingStaffAction(
  businessId: string,
  input: { name: string; roleTitle?: string; color?: string; email?: string; phone?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return { ok: false, error: gate.error };
    const err = validateName(input.name);
    if (err) return { ok: false, error: err };

    await createBookingStaff(businessId, {
      name: input.name.trim(),
      roleTitle: input.roleTitle?.trim().slice(0, 80) || null,
      color: input.color ?? null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    });
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function updateBookingStaffAction(
  businessId: string,
  staffId: string,
  fields: {
    name?: string;
    roleTitle?: string | null;
    color?: string | null;
    active?: boolean;
    sort?: number;
    hours?: WeeklyHours | null;
    email?: string | null;
    phone?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return { ok: false, error: gate.error };
    if (fields.name !== undefined) {
      const err = validateName(fields.name);
      if (err) return { ok: false, error: err };
    }

    await updateBookingStaff(businessId, staffId, {
      ...fields,
      name: fields.name?.trim(),
      roleTitle: fields.roleTitle === undefined ? undefined : fields.roleTitle?.trim().slice(0, 80) || null,
    });
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "העדכון נכשל" };
  }
}

export async function deleteBookingStaffAction(
  businessId: string,
  staffId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return { ok: false, error: gate.error };
    await deleteBookingStaff(businessId, staffId);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function setStaffServicesAction(
  businessId: string,
  staffId: string,
  serviceIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const gate = await assertOwnerAndFeature(businessId);
    if (gate.error) return { ok: false, error: gate.error };
    await setStaffServices(businessId, staffId, serviceIds);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}
