"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Json, ProductEngraving } from "@/types/database";

export type CartItem = {
  productId: string;
  name: string;
  unitPrice: number | null;
  variant: string | null;
  variantId: string | null;
  quantity: number;
  image: string | null;
  /** Personalization text the shopper typed for this line (or null when none). */
  engraving: string | null;
};

/**
 * Defensively parses a product's `engraving` jsonb config. Returns null when
 * personalization isn't enabled or the JSON is malformed/missing, so callers
 * can treat "no engraving" uniformly instead of guarding on shape everywhere.
 * Fields left unset by the merchant (label/maxChars) are returned undefined —
 * consumers apply their own display defaults.
 */
export function parseEngraving(json: Json | null | undefined): ProductEngraving | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const obj = json as Record<string, Json | undefined>;
  if (obj.enabled !== true) return null;
  const label = typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : undefined;
  const maxCharsNum = Number(obj.maxChars);
  const maxChars =
    typeof obj.maxChars !== "undefined" && Number.isFinite(maxCharsNum) && maxCharsNum > 0
      ? Math.min(60, Math.floor(maxCharsNum))
      : undefined;
  const required = obj.required === true;
  // 1 input by default; 2 for e.g. couple sets (one engraving per piece).
  const fieldsNum = Number(obj.fields);
  const fields =
    Number.isFinite(fieldsNum) && fieldsNum >= 2 ? Math.min(2, Math.floor(fieldsNum)) : 1;
  return { enabled: true, label, maxChars, required, fields };
}

type CartContextValue = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  total: number;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Stable key per product+variant+engraving so the same variant stacks in one
 * line — but a differently-engraved line (e.g. a different name to engrave)
 * stays separate, since it's effectively a distinct purchasable item.
 */
export function lineKey(i: {
  productId: string;
  variant: string | null;
  engraving?: string | null;
}): string {
  return `${i.productId}|${i.variant ?? ""}|${i.engraving ?? ""}`;
}

export function CartProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const storageKey = `mode-cart:${slug}`;
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydrate once from localStorage after mount. Starting empty keeps SSR and
  // the first client render identical (no hydration mismatch); this effect then
  // syncs in the persisted cart — a legitimate read from an external system.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        // Older persisted carts predate the `engraving` field — backfill null.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(parsed.map((it) => ({ ...it, engraving: it.engraving ?? null })));
      }
    } catch {
      // ignore corrupt/unavailable storage
    }
  }, [storageKey]);

  // Persist on every change (no setState — safe in effect).
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore quota/availability errors
    }
  }, [storageKey, items]);

  const add = useCallback((item: Omit<CartItem, "quantity">, qty: number) => {
    setItems((prev) => {
      const k = lineKey(item);
      const existing = prev.find((p) => lineKey(p) === k);
      if (existing) {
        return prev.map((p) =>
          lineKey(p) === k ? { ...p, quantity: Math.min(99, p.quantity + qty) } : p,
        );
      }
      return [...prev, { ...item, quantity: Math.min(99, Math.max(1, qty)) }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((p) => (lineKey(p) === key ? { ...p, quantity: qty } : p))
        .filter((p) => p.quantity > 0),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => lineKey(p) !== key));
  }, []);

  // Clear also wipes localStorage synchronously so the post-purchase
  // re-hydration (which runs after the clear) can't restore the old cart.
  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setItems([]);
  }, [storageKey]);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({ items, add, setQty, remove, clear, count, total }),
    [items, add, setQty, remove, clear, count, total],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
