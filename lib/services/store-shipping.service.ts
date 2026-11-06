import { createClient } from "@/lib/supabase/server";
import type { ShippingMethod, Warehouse, Json } from "@/types/database";

/**
 * Owner-side shipping/logistics service (RLS via the owner's session): manage
 * shipping methods + warehouses and stamp tracking numbers on orders. Public
 * checkout reads active methods through getPublicSiteBySlug.
 */

export type ShippingMethodInput = {
  name: string;
  type: ShippingMethod["type"];
  price: number;
  eta?: string | null;
  free_over?: number | null;
  details?: Json | null;
  active?: boolean;
};

export async function listShippingMethods(businessId: string): Promise<ShippingMethod[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shipping_methods")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true });
  return data ?? [];
}

/** Replaces the business's shipping methods (delete-then-insert; small volumes). */
export async function replaceShippingMethods(
  businessId: string,
  methods: ShippingMethodInput[],
): Promise<void> {
  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from("shipping_methods")
    .delete()
    .eq("business_id", businessId);
  if (delErr) throw new Error(delErr.message);

  const rows = methods
    .filter((m) => m.name.trim())
    .map((m, i) => ({
      business_id: businessId,
      name: m.name.trim().slice(0, 80),
      type: m.type,
      price: Math.max(0, Number(m.price) || 0),
      eta: m.eta?.trim() || null,
      free_over: m.free_over != null && !isNaN(Number(m.free_over)) ? Math.max(0, Number(m.free_over)) : null,
      details: m.details ?? null,
      active: m.active ?? true,
      sort: i,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("shipping_methods").insert(rows);
  if (error) throw new Error(error.message);
}

// ── Warehouses ──────────────────────────────────────────────────────────────

export async function listWarehouses(businessId: string): Promise<Warehouse[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function upsertWarehouse(
  businessId: string,
  input: { id?: string; name: string; address?: string | null; phone?: string | null; is_default?: boolean },
): Promise<void> {
  const supabase = await createClient();
  if (input.is_default) {
    await supabase
      .from("warehouses")
      .update({ is_default: false })
      .eq("business_id", businessId)
      .eq("is_default", true);
  }
  const payload = {
    name: input.name.trim().slice(0, 80),
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    is_default: input.is_default ?? false,
  };
  if (input.id) {
    const { error } = await supabase
      .from("warehouses")
      .update(payload)
      .eq("id", input.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("warehouses")
      .insert({ ...payload, business_id: businessId });
    if (error) throw new Error(error.message);
  }
}

export async function deleteWarehouse(businessId: string, id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("warehouses")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}

// ── Order tracking ──────────────────────────────────────────────────────────

export async function setOrderTracking(
  orderId: string,
  trackingNumber: string | null,
  carrier: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ tracking_number: trackingNumber, tracking_carrier: carrier })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}
