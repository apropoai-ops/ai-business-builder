/**
 * Lightweight business-type heuristics used to route type-specific features to
 * the businesses they actually fit — so e.g. a fashion store never sees the
 * vacation-rental (date-reservation) module, while a צימר business does.
 *
 * Pure & dependency-free so it can run anywhere (nav gating, generation, tests).
 */

function haystack(b: {
  industry?: string | null;
  type?: string | null;
  description?: string | null;
  name?: string | null;
}): string {
  return `${b.industry ?? ""} ${b.type ?? ""} ${b.description ?? ""} ${b.name ?? ""}`.toLowerCase();
}

/**
 * Accommodation / hospitality businesses (צימר, B&B, hotel, villa, vacation
 * rental…) — the ones that need the date-range reservation system.
 */
export function isHospitality(b: {
  industry?: string | null;
  type?: string | null;
  description?: string | null;
  name?: string | null;
}): boolean {
  const hay = haystack(b);
  const words = [
    "צימר",
    "צימרים",
    "אירוח",
    "נופש",
    "מלונ",
    "וילה",
    "אכסני",
    "סוויט",
    "בקתה",
    "בקתות",
    "לינה",
    "חדרי",
    "guesthouse",
    "guest house",
    "b&b",
    "bnb",
    "hotel",
    "hostel",
    "lodging",
    "accommodation",
    "vacation rental",
    "villa",
    "resort",
    "cabin",
    "airbnb",
  ];
  return words.some((w) => hay.includes(w));
}

/**
 * Does this business conceptually sell nights — i.e. did the AI
 * classification (migration 0092, lib/ai/agents/nav-relevance.ts) NOT mark
 * "rentals" as irrelevant for this vertical? This supersedes the raw
 * `isHospitality()` keyword scan for every nav/upsell decision — the scan
 * itself now only survives as that classifier's own offline fallback.
 */
export function businessFitsRentals(b: { hidden_nav_keys?: string[] | null }): boolean {
  return !(b.hidden_nav_keys ?? []).includes("rentals");
}
