import { generateMarketResearch } from "@/lib/ai/agents/market-research";
import { getBusiness } from "@/lib/services/business.service";
import { upsertMarketResearch } from "@/lib/services/market-research.service";
import {
  createJob,
  getLatestJob,
  setJobStatus,
} from "@/lib/services/job.service";
import type { Json } from "@/types/database";

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string }
  | { status: "skipped"; reason: string };

export async function runMarketResearchJob(
  businessId: string,
): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  let job = await getLatestJob(businessId, "market_research");
  if (job && (job.status === "running" || job.status === "succeeded")) {
    return job.status === "running"
      ? { status: "running" }
      : { status: "skipped", reason: "כבר הושלם" };
  }
  if (!job) {
    job = await createJob(businessId, "market_research");
  }

  await setJobStatus(job.id, "running");

  try {
    const data = await generateMarketResearch(business);

    await upsertMarketResearch(businessId, {
      competitors: data.competitors as unknown as Json,
      swot: data.swot as unknown as Json,
      opportunities: data.opportunities as unknown as Json,
      positioning: data.positioning,
      generated_at: new Date().toISOString(),
    });

    await setJobStatus(job.id, "succeeded");
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobStatus(job.id, "failed", { error: message });
    return { status: "failed", error: message };
  }
}
