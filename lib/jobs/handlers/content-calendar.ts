import { generateContentCalendar } from "@/lib/ai/agents/content-calendar";
import { getBusiness } from "@/lib/services/business.service";
import {
  clearCalendar,
  insertCalendarEntries,
} from "@/lib/services/content-calendar.service";
import { createJob, getLatestJob, setJobStatus } from "@/lib/services/job.service";
import type { CalendarPeriod } from "@/lib/ai/schemas/content-calendar";

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string };

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function runContentCalendarJob(
  businessId: string,
  period: CalendarPeriod,
): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  const existing = await getLatestJob(businessId, "content_calendar");
  if (existing?.status === "running") return { status: "running" };

  const job = await createJob(businessId, "content_calendar", { period });
  await setJobStatus(job.id, "running");

  try {
    const plan = await generateContentCalendar(business, period);

    // Regenerating replaces the existing calendar.
    await clearCalendar(businessId);

    const today = new Date();
    await insertCalendarEntries(
      businessId,
      plan.entries.map((e) => ({
        scheduled_for: addDays(today, e.dayOffset),
        platform: e.platform,
        content_type: e.contentType,
        title: e.title,
        idea: e.idea ?? null,
      })),
    );

    await setJobStatus(job.id, "succeeded");
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobStatus(job.id, "failed", { error: message });
    return { status: "failed", error: message };
  }
}
