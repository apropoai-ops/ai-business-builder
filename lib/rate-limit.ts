import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Fixed-window rate limiter backed by Postgres (rate_limits + bump_rate_limit
 * RPC). Durable across serverless instances, no extra infra.
 *
 * Fail-open: if the limiter itself errors, the request is allowed — the
 * product must not break because of the guard rail.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("bump_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

export const RATE_LIMIT_MESSAGE =
  "חרגתם ממכסת השימוש לשעה זו — נסו שוב מאוחר יותר";
