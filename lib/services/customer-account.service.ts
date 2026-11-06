import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderItem,
  CustomerAddress,
  CustomerPaymentMethod,
  CustomerProfile,
} from "@/types/database";

/**
 * Customer-facing data access for the storefront personal area. Everything here
 * runs under the *shopper's* session (RLS scopes rows to auth.uid()), except the
 * public slug→business resolution which uses the service-role client.
 */

/** An order in the shopper's personal history, with its line items + invoice. */
export type CustomerOrder = Order & { items: OrderItem[]; invoiceId: string | null };

/** Resolves a published storefront slug to its business id (public info). */
async function businessIdForSlug(slug: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return data?.business_id ?? null;
}

// ── Order history ───────────────────────────────────────────────────────────

/**
 * The signed-in shopper's order history for one store. RLS (orders_customer_select)
 * guarantees only their own orders return; we additionally scope to this store's
 * business so the personal area stays per-store.
 */
export async function getCustomerOrders(
  slug: string,
  userId: string,
): Promise<CustomerOrder[]> {
  const businessId = await businessIdForSlug(slug);
  if (!businessId) return [];

  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_user_id", userId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !orders?.length) return [];

  const ids = orders.map((o) => o.id);
  const [{ data: items }, { data: invoices }] = await Promise.all([
    supabase.from("order_items").select("*").in("order_id", ids),
    supabase.from("order_invoices").select("id, order_id").in("order_id", ids),
  ]);

  const byOrder: Record<string, OrderItem[]> = {};
  for (const it of items ?? []) (byOrder[it.order_id] ??= []).push(it);
  const invoiceByOrder: Record<string, string> = {};
  for (const inv of invoices ?? []) invoiceByOrder[inv.order_id] = inv.id;

  return orders.map((o) => ({
    ...o,
    items: byOrder[o.id] ?? [],
    invoiceId: invoiceByOrder[o.id] ?? null,
  }));
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function getCustomerProfile(
  userId: string,
): Promise<CustomerProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function upsertCustomerProfile(
  userId: string,
  input: { full_name?: string | null; phone?: string | null },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("customer_profiles").upsert(
    {
      id: userId,
      full_name: input.full_name ?? null,
      phone: input.phone ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

// ── Addresses ───────────────────────────────────────────────────────────────

export async function listAddresses(userId: string): Promise<CustomerAddress[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** The shopper's default address (or their most recent), used to prefill checkout. */
export async function getDefaultAddress(
  userId: string,
): Promise<CustomerAddress | null> {
  const list = await listAddresses(userId);
  return list[0] ?? null;
}

export async function createAddress(
  userId: string,
  input: Omit<CustomerAddress, "id" | "user_id" | "created_at">,
): Promise<void> {
  const supabase = await createClient();
  if (input.is_default) await clearDefaultAddresses(userId);
  const { error } = await supabase
    .from("customer_addresses")
    .insert({ ...input, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function updateAddress(
  userId: string,
  id: string,
  input: Partial<Omit<CustomerAddress, "id" | "user_id" | "created_at">>,
): Promise<void> {
  const supabase = await createClient();
  if (input.is_default) await clearDefaultAddresses(userId);
  const { error } = await supabase
    .from("customer_addresses")
    .update(input)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

async function clearDefaultAddresses(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
}

// ── Payment methods (display metadata only — real vault lands in Wave B) ─────

export async function listPaymentMethods(
  userId: string,
): Promise<CustomerPaymentMethod[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_payment_methods")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createPaymentMethod(
  userId: string,
  input: {
    label?: string | null;
    brand?: string | null;
    last4?: string | null;
    exp_month?: number | null;
    exp_year?: number | null;
    is_default?: boolean;
  },
): Promise<void> {
  const supabase = await createClient();
  if (input.is_default) await clearDefaultPaymentMethods(userId);
  const { error } = await supabase
    .from("customer_payment_methods")
    .insert({ ...input, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function deletePaymentMethod(
  userId: string,
  id: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_payment_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setDefaultPaymentMethod(
  userId: string,
  id: string,
): Promise<void> {
  const supabase = await createClient();
  await clearDefaultPaymentMethods(userId);
  const { error } = await supabase
    .from("customer_payment_methods")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

async function clearDefaultPaymentMethods(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("customer_payment_methods")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
}
