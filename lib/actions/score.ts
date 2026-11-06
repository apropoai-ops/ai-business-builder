"use server";

import { getScoreHistory, getScoreMetrics } from "@/lib/services/business-score.service";
import type { ScoreHistoryPoint, ScoreMetrics } from "@/lib/business-score";

/**
 * Client-facing wrappers for the score screen (components/business/score-view.tsx)
 * — the service module touches lib/supabase/server, so the client component
 * reaches it only through these server actions.
 */

export async function getScoreHistoryAction(businessId: string): Promise<ScoreHistoryPoint[]> {
  return getScoreHistory(businessId);
}

export async function getScoreMetricsAction(businessId: string): Promise<ScoreMetrics> {
  return getScoreMetrics(businessId);
}
