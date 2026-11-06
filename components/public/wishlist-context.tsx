"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type WishlistItem = {
  productId: string;
  name: string;
  image: string | null;
  unitPrice: number | null;
};

type WishlistContextValue = {
  items: WishlistItem[];
  toggle: (item: WishlistItem) => void;
  has: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const storageKey = `mode-wishlist:${slug}`;
  const [items, setItems] = useState<WishlistItem[]>([]);

  // Hydrate once from localStorage after mount. Starting empty keeps SSR and
  // the first client render identical (no hydration mismatch); this effect then
  // syncs in the persisted wishlist — a legitimate read from an external system.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw) as WishlistItem[]);
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

  const toggle = useCallback((item: WishlistItem) => {
    setItems((prev) => {
      if (prev.some((p) => p.productId === item.productId)) {
        return prev.filter((p) => p.productId !== item.productId);
      }
      return [...prev, item];
    });
  }, []);

  const has = useCallback(
    (productId: string) => items.some((p) => p.productId === productId),
    [items],
  );

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.length, [items]);

  const value = useMemo(
    () => ({ items, toggle, has, remove, clear, count }),
    [items, toggle, has, remove, clear, count],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
