"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";

/** Compact snapshot stored per-store in localStorage. */
type RecentItem = {
  id: string;
  name: string;
  image: string | null;
  price: number | null;
  sale_price: number | null;
};

const MAX_ITEMS = 8;

function storageKey(slug: string): string {
  return `mode-recent:${slug}`;
}

/** Effective (display) price — sale price when it's a real discount, else price. */
function effectivePrice(item: RecentItem): number | null {
  if (item.sale_price != null && item.price != null && item.sale_price < item.price) {
    return item.sale_price;
  }
  return item.price;
}

/**
 * Push a product to the front of the per-store "recently viewed" list.
 * De-duped by id, most-recent-first, capped at {@link MAX_ITEMS}.
 * Stores a compact snapshot so the strip can render without re-fetching.
 */
export function trackRecentlyViewed(
  slug: string,
  product: {
    id: string;
    name: string;
    image: string | null;
    price: number | null;
    sale_price: number | null;
  },
): void {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(slug);
    const raw = window.localStorage.getItem(key);
    let list: RecentItem[] = [];
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed as RecentItem[];
    }
    const snapshot: RecentItem = {
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      sale_price: product.sale_price,
    };
    const next = [snapshot, ...list.filter((p) => p.id !== snapshot.id)].slice(0, MAX_ITEMS);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore quota / serialization / disabled-storage errors — tracking is best-effort.
  }
}

/** Horizontal scroll strip of small cards for products viewed in this store. */
export function RecentlyViewed({ slug, brand }: { slug: string; brand: string }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(slug));
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(parsed as RecentItem[]);
    } catch {
      // Best-effort read — leave the list empty on any error.
    }
  }, [slug]);

  if (items.length < 1) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h3 className="mb-4 text-lg font-bold">נצפו לאחרונה</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((item) => {
          const eff = effectivePrice(item);
          return (
            <div
              key={item.id}
              className="svc-card flex w-36 shrink-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.name} className="h-28 w-full bg-white object-contain p-2" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center" style={{ background: `${brand}10` }}>
                  <Package className="size-7" style={{ color: brand }} />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className="line-clamp-2 text-sm font-bold">{item.name}</span>
                {eff !== null && (
                  <span className="mt-auto text-sm font-extrabold" style={{ color: brand }}>
                    ₪{eff.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
