"use client";

import { useState } from "react";

/**
 * Client-side accumulator for the leads/customers/deals "טען עוד" pagination.
 * `initialItems` is whatever the server component loaded for page 1 (bounded
 * to CRM_PAGE_SIZE — see lib/services/crm.service.ts); this hook appends
 * further pages fetched on demand.
 *
 * When `initialItems` changes identity (e.g. after `router.refresh()` re-runs
 * the server component with fresh page-1 data), the accumulated extra pages
 * are dropped — detected during render (no effect), mirroring the
 * `loadedForId` render-phase-guard pattern used elsewhere in this codebase.
 */
export function usePaginatedList<T>(initialItems: T[], pageSize: number) {
  const [trackedInitial, setTrackedInitial] = useState(initialItems);
  const [extra, setExtra] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialItems.length >= pageSize);
  const [loading, setLoading] = useState(false);

  const isFreshInitial = trackedInitial !== initialItems;
  const effectiveExtra = isFreshInitial ? [] : extra;
  if (isFreshInitial) {
    setTrackedInitial(initialItems);
    setExtra([]);
    setPage(1);
    setHasMore(initialItems.length >= pageSize);
  }

  async function loadMore(fetchPage: (page: number) => Promise<{ items: T[]; error?: string }>) {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await fetchPage(nextPage);
      if (!res.error) {
        setExtra((prev) => [...prev, ...res.items]);
        setPage(nextPage);
        setHasMore(res.items.length >= pageSize);
      }
      return res;
    } finally {
      setLoading(false);
    }
  }

  return {
    items: [...initialItems, ...effectiveExtra],
    hasMore,
    loading,
    loadMore,
  };
}
