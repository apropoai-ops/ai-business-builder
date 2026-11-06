"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getWebsite } from "@/lib/services/website.service";
import {
  replaceShippingMethods,
  upsertWarehouse,
  deleteWarehouse,
  setOrderTracking,
  type ShippingMethodInput,
} from "@/lib/services/store-shipping.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";

type Result = { ok: boolean; error?: string };

async function revalidateStore(businessId: string) {
  revalidatePath(`/businesses/${businessId}/store`);
  revalidatePath(`/businesses/${businessId}/orders`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

const VALID_TYPES = ["delivery", "express", "pickup", "pickup_point", "by_region"];

export async function saveShippingMethodsAction(
  businessId: string,
  methods: ShippingMethodInput[],
): Promise<Result> {
  await requireUser();
  const plan = await getPlanForBusiness(businessId);
  try {
    assertFeature(plan, "store_full");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
  if (!Array.isArray(methods) || methods.length > 30) {
    return { ok: false, error: "יותר מדי שיטות משלוח" };
  }
  for (const m of methods) {
    if (!m.name?.trim()) return { ok: false, error: "לכל שיטת משלוח דרוש שם" };
    if (!VALID_TYPES.includes(m.type)) return { ok: false, error: "סוג משלוח לא תקין" };
  }
  try {
    await replaceShippingMethods(businessId, methods);
    await revalidateStore(businessId);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

export async function saveWarehouseAction(
  businessId: string,
  input: { id?: string; name: string; address: string; phone: string; is_default: boolean },
): Promise<Result> {
  await requireUser();
  if (!input.name?.trim()) return { ok: false, error: "נא להזין שם מחסן" };
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "store_full");
    await upsertWarehouse(businessId, input);
    await revalidateStore(businessId);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

export async function deleteWarehouseAction(businessId: string, id: string): Promise<Result> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "store_full");
    await deleteWarehouse(businessId, id);
    await revalidateStore(businessId);
    return { ok: true };
  } catch {
    return { ok: false, error: "המחיקה נכשלה" };
  }
}

export async function setOrderTrackingAction(
  businessId: string,
  orderId: string,
  trackingNumber: string,
  carrier: string,
): Promise<Result> {
  await requireUser();
  try {
    await setOrderTracking(orderId, trackingNumber.trim() || null, carrier.trim() || null);
    revalidatePath(`/businesses/${businessId}/orders`);
    return { ok: true };
  } catch {
    return { ok: false, error: "העדכון נכשל" };
  }
}
