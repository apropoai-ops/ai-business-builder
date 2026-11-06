/** Converts a 1-based page + page size into a Supabase `.range(from, to)` pair. */
export function toRange(page: number, pageSize: number): [number, number] {
  const from = (Math.max(1, page) - 1) * pageSize;
  return [from, from + pageSize - 1];
}
