import type { ShippingMethod } from "@/types/database";

/**
 * Shipping-method domain helpers (pure). Resolves the price + a human label for
 * a chosen method, handling per-region pricing, pickup points, and per-method
 * free-shipping thresholds. Used by both the storefront and the server (which
 * re-computes price authoritatively).
 */

export const SHIPPING_TYPES: { key: ShippingMethod["type"]; label: string }[] = [
  { key: "delivery", label: "משלوח רגיל" },
  { key: "express", label: "משלוח אקספרס" },
  { key: "pickup", label: "איסוף עצמי" },
  { key: "pickup_point", label: "נקודת איסוף" },
  { key: "by_region", label: "משלוח לפי אזור" },
];

export function shippingTypeLabel(type: string): string {
  return SHIPPING_TYPES.find((t) => t.key === type)?.label ?? type;
}

export type RegionRate = { name: string; price: number };
export type PickupPoint = { name: string; address?: string };

export function methodRegions(m: Pick<ShippingMethod, "details">): RegionRate[] {
  const r = (m.details as { regions?: unknown } | null)?.regions;
  return Array.isArray(r)
    ? r
        .map((x) => ({ name: String((x as RegionRate).name ?? ""), price: Number((x as RegionRate).price) || 0 }))
        .filter((x) => x.name)
    : [];
}

export function methodPoints(m: Pick<ShippingMethod, "details">): PickupPoint[] {
  const p = (m.details as { points?: unknown } | null)?.points;
  return Array.isArray(p)
    ? p
        .map((x) => ({ name: String((x as PickupPoint).name ?? ""), address: (x as PickupPoint).address }))
        .filter((x) => x.name)
    : [];
}

/**
 * Resolves the shipping price + detail label for a chosen method. `region`/
 * `point` are the shopper's sub-selections (for by_region / pickup_point).
 * Returns null if the selection is invalid (e.g. a region that doesn't exist).
 */
export function resolveShipping(
  method: Pick<ShippingMethod, "type" | "price" | "free_over" | "details">,
  opts: { region?: string | null; point?: string | null },
  subtotal: number,
): { price: number; detail: string | null } | null {
  let price = Number(method.price) || 0;
  let detail: string | null = null;

  if (method.type === "by_region") {
    const regions = methodRegions(method);
    if (regions.length > 0) {
      const r = regions.find((x) => x.name === opts.region);
      if (!r) return null;
      price = r.price;
      detail = r.name;
    }
  } else if (method.type === "pickup_point") {
    const points = methodPoints(method);
    if (points.length > 0) {
      const p = points.find((x) => x.name === opts.point);
      if (!p) return null;
      detail = p.address ? `${p.name} — ${p.address}` : p.name;
    }
  }

  // Per-method free-shipping threshold (on the merchandise subtotal).
  if (method.free_over != null && Number(method.free_over) > 0 && subtotal >= Number(method.free_over)) {
    price = 0;
  }

  return { price, detail };
}
