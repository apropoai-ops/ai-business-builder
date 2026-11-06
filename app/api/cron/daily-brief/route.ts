import { NextRequest, NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateDailyBrief } from "@/lib/services/daily-brief.service";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/types/database";

// Generating briefs for several businesses can take a while.
export const maxDuration = 300;

/**
 * GET /api/cron/daily-brief — Vercel Cron (configured in vercel.json).
 * Generates today's AI CEO brief for every active business. Secured with
 * CRON_SECRET (Vercel sends it as a Bearer token automatically).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("status", "ready")
    .order("updated_at", { ascending: false })
    .limit(20);

  // Cost gate: the daily brief is a PRO+ feature. Only auto-generate it for
  // owners whose plan includes it — never burn AI on free/BASIC businesses.
  const ownerIds = [...new Set((businesses ?? []).map((b) => b.owner_id))];
  const planByOwner = new Map<string, PlanTier>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, plan")
      .in("id", ownerIds);
    for (const p of profiles ?? []) planByOwner.set(p.id, (p.plan as PlanTier) ?? "free");
  }
  const eligible = (businesses ?? []).filter(
    (b) => PLANS[planByOwner.get(b.owner_id) ?? "free"].dailyBrief,
  );

  let generated = 0;
  const skipped = (businesses ?? []).length - eligible.length;
  const errors: string[] = [];

  for (const business of eligible) {
    try {
      await generateDailyBrief(business); // idempotent — skips if today's exists
      generated++;
    } catch (e) {
      errors.push(`${business.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return NextResponse.json({ generated, skipped, errors: errors.length ? errors : undefined });
}
