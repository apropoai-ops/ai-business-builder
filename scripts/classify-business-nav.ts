/**
 * One-time backfill: runs the AI nav-relevance classifier (migration 0092,
 * lib/ai/agents/nav-relevance.ts) over every business that predates it, so
 * existing businesses get the same "לוח לילות doesn't belong on a CarPlay
 * store" treatment as newly-created ones, not just going forward.
 *
 *   npx tsx --env-file=.env.local scripts/classify-business-nav.ts
 *
 * (--env-file, not a dotenv call: ESM hoists imports, so lib/ai/providers.ts
 * would read process.env before any in-file loader ran — see seed-mode-demos.ts.)
 *
 * Idempotent: only businesses with ai_nav_classified_at still null are
 * touched, so a second run is a no-op. Continues past a per-row failure
 * (logs it) rather than aborting the whole batch.
 */
import { createClient } from "@supabase/supabase-js";

import { classifyHiddenNavKeys } from "@/lib/ai/agents/nav-relevance";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function run() {
  const { data: businesses, error } = await db
    .from("businesses")
    .select("id, name, industry, type, description")
    .is("ai_nav_classified_at", null);
  if (error) throw new Error(`Failed to load businesses: ${error.message}`);

  console.log(`${businesses?.length ?? 0} business(es) to classify.\n`);

  let ok = 0;
  let failed = 0;
  for (const business of businesses ?? []) {
    try {
      const hidden = await classifyHiddenNavKeys(business);
      const { error: updateError } = await db
        .from("businesses")
        .update({
          hidden_nav_keys: hidden,
          ai_nav_classified_at: new Date().toISOString(),
        })
        .eq("id", business.id);
      if (updateError) throw new Error(updateError.message);
      ok++;
      console.log(`✔ ${business.name ?? business.id} — hidden: [${hidden.join(", ") || "—"}]`);
    } catch (e) {
      failed++;
      console.error(`✘ ${business.name ?? business.id} (${business.id}):`, e);
    }
  }

  console.log(`\nDone. ${ok} classified, ${failed} failed.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
