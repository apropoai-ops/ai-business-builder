"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import { listGatewayMeta } from "@/lib/gateways/registry";
import {
  listConnections,
  saveConnection,
  setConnectionEnabled,
  deleteConnection,
  type ConnectionSummary,
} from "@/lib/services/payment-connections.service";
import type { GatewayMeta } from "@/lib/gateways/registry";

/**
 * Server actions for the "ספקי סליקה" (payment gateways) connect UI — lets a
 * store owner connect their OWN Israeli payment provider so storefront card
 * payments are charged directly to their account. Mirrors the gating pattern
 * in lib/actions/store-payments.ts: requireUser + assertFeature("store_full")
 * wrapped in try/catch so a plan downgrade surfaces as a friendly {ok:false}
 * instead of a thrown 500. Ownership is enforced by getBusiness, which reads
 * through the RLS-scoped client and returns null for a business the caller
 * doesn't own.
 */

type Result = { ok: boolean; error?: string };

function revalidateStore(businessId: string) {
  revalidatePath(`/businesses/${businessId}/store`);
}

async function verifyOwnership(businessId: string) {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) throw new Error("העסק לא נמצא");
  return business;
}

export async function getGatewaysAction(
  businessId: string,
): Promise<{ meta: GatewayMeta[]; connections: ConnectionSummary[] }> {
  await verifyOwnership(businessId);
  const [meta, connections] = await Promise.all([
    listGatewayMeta(),
    listConnections(businessId),
  ]);
  return { meta, connections };
}

export async function saveGatewayConnectionAction(
  businessId: string,
  provider: string,
  credentials: Record<string, string>,
): Promise<Result> {
  await verifyOwnership(businessId);
  const plan = await getPlanForBusiness(businessId);
  try {
    assertFeature(plan, "store_full");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }

  const res = await saveConnection(businessId, provider, credentials);
  if (!res.ok) return res;
  revalidateStore(businessId);
  return { ok: true };
}

export async function setGatewayEnabledAction(
  businessId: string,
  provider: string,
  enabled: boolean,
): Promise<Result> {
  await verifyOwnership(businessId);
  const plan = await getPlanForBusiness(businessId);
  try {
    assertFeature(plan, "store_full");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }

  const res = await setConnectionEnabled(businessId, provider, enabled);
  if (!res.ok) return res;
  revalidateStore(businessId);
  return { ok: true };
}

export async function deleteGatewayConnectionAction(
  businessId: string,
  provider: string,
): Promise<Result> {
  await verifyOwnership(businessId);
  const plan = await getPlanForBusiness(businessId);
  try {
    assertFeature(plan, "store_full");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }

  const res = await deleteConnection(businessId, provider);
  if (!res.ok) return res;
  revalidateStore(businessId);
  return { ok: true };
}
