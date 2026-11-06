"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export type WatchedJob = {
  id: string;
  type: string;
  status: string;
  error: string | null;
};

/**
 * Watches job rows for a business via Supabase Realtime and reports
 * terminal states (succeeded/failed). A slow safety poll (15s) backs up
 * the subscription in case the websocket drops — net effect: updates feel
 * instant, with none of the old 2.5s polling hammering.
 */
export function useJobWatcher({
  businessId,
  jobTypes,
  onTerminal,
  fallbackPoll,
}: {
  businessId: string;
  jobTypes?: string[];
  onTerminal: (job: WatchedJob) => void;
  fallbackPoll?: () => void | Promise<void>;
}) {
  // Keep latest callbacks without resubscribing on every render.
  const onTerminalRef = useRef(onTerminal);
  const fallbackRef = useRef(fallbackPoll);
  const typesRef = useRef(jobTypes);
  useEffect(() => {
    onTerminalRef.current = onTerminal;
    fallbackRef.current = fallbackPoll;
    typesRef.current = jobTypes;
  });

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // The realtime socket must carry the USER's JWT, not the anon key —
      // otherwise RLS registers the subscription as `anon` and silently
      // delivers nothing (jobs has owner-only policies).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`jobs-${businessId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "jobs",
            filter: `business_id=eq.${businessId}`,
          },
          (payload) => {
            const job = payload.new as WatchedJob;
            if (typesRef.current && !typesRef.current.includes(job.type)) return;
            if (job.status === "succeeded" || job.status === "failed") {
              onTerminalRef.current(job);
            }
          },
        )
        .subscribe();
    })();

    const interval = setInterval(() => {
      void fallbackRef.current?.();
    }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [businessId]);
}
