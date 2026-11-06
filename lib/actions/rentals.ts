"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getCustomerUser } from "@/lib/auth/customer";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBusiness } from "@/lib/services/business.service";
import { getWebsite } from "@/lib/services/website.service";
import {
  createUnit,
  updateUnit,
  deleteUnit,
  setReservationStatus,
  createPendingRentalBooking,
} from "@/lib/services/rentals.service";
import { createRentalPaymentRedirect } from "@/lib/services/store-checkout.service";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import { normalizeUnitImages } from "@/lib/rentals";

async function revalidateRentals(businessId: string) {
  // The units are managed from the חנות screen (the standalone /rentals route
  // is now just a redirect), so that is the page that has to go stale.
  revalidatePath(`/businesses/${businessId}/store`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

// ── Owner ────────────────────────────────────────────────────────────────────

export async function saveUnitAction(
  businessId: string,
  input: {
    id?: string;
    name: string;
    description?: string;
    images?: string[];
    nightly_price: string;
    max_guests: string;
    active: boolean;
  },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "rentals", await getActiveAddonsForBusiness(businessId));
    const name = input.name?.trim();
    if (!name) return { error: "נא להזין שם ליחידה" };
    const price = Number(input.nightly_price);
    if (!Number.isFinite(price) || price < 0) return { error: "מחיר ללילה לא תקין" };
    const guests = Math.max(1, Math.min(Number(input.max_guests) || 2, 99));

    // images[0] is the cover; image_url mirrors it so single-URL readers keep working.
    const images = normalizeUnitImages(input.images);

    const fields = {
      name: name.slice(0, 120),
      description: input.description?.trim().slice(0, 1000) || null,
      image_url: images[0] ?? null,
      images: images.length > 0 ? images : null,
      nightly_price: price,
      max_guests: guests,
      active: input.active,
    };
    const res = input.id ? await updateUnit(input.id, fields) : await createUnit(businessId, fields);
    if (res.error) return res;
    await revalidateRentals(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function deleteUnitAction(businessId: string, id: string): Promise<{ error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "rentals", await getActiveAddonsForBusiness(businessId));
    await deleteUnit(id);
    await revalidateRentals(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function setReservationStatusAction(
  businessId: string,
  id: string,
  status: "confirmed" | "cancelled",
): Promise<{ error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "rentals", await getActiveAddonsForBusiness(businessId));
    const res = await setReservationStatus(id, status);
    if (res.error) return res;
    await revalidateRentals(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "העדכון נכשל" };
  }
}

// ── Public (anonymous guests on /s/[slug]) ────────────────────────────────────

export async function startRentalCheckoutAction(
  slug: string,
  input: {
    unitId: string;
    checkIn: string;
    checkOut: string;
    name: string;
    phone: string;
    email?: string;
    guests: number;
    notes?: string;
    company_website?: string; // honeypot
  },
): Promise<{ ok: boolean; error?: string; url?: string }> {
  if (input.company_website) return { ok: true };
  if (!(await checkRateLimit(`rental:${slug}`, 15, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const name = input.name?.trim().slice(0, 120);
  const phone = input.phone?.trim().slice(0, 40);
  if (!name || name.length < 2) return { ok: false, error: "נא למלא שם" };
  if (!phone || phone.replace(/\D/g, "").length < 9) return { ok: false, error: "נא למלא טלפון תקין" };
  if (!/^[0-9a-f-]{36}$/i.test(input.unitId)) return { ok: false, error: "יחידה לא תקינה" };

  const email =
    typeof input.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())
      ? input.email.trim().slice(0, 160)
      : null;

  const customer = await getCustomerUser();

  const res = await createPendingRentalBooking(slug, {
    unitId: input.unitId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestName: name,
    guestPhone: phone,
    guestEmail: email,
    guests: Number(input.guests) || 1,
    customerUserId: customer?.id ?? null,
    notes: input.notes?.trim().slice(0, 300) || null,
  });
  if (!res.ok || !res.bookingId) return { ok: false, error: res.error ?? "ההזמנה נכשלה" };
  if (!res.total || res.total < 2) {
    return { ok: false, error: "מחיר היחידה אינו מוגדר לתשלום בכרטיס" };
  }

  try {
    const url = await createRentalPaymentRedirect({
      slug,
      bookingId: res.bookingId,
      amount: res.total,
      label: `הזמנת אירוח · ${res.nights} לילות`,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
    });
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "פתיחת התשלום נכשלה" };
  }
}
