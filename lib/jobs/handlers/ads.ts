import { generateAdStrategy } from "@/lib/ai/agents/ads";
import { getBusiness } from "@/lib/services/business.service";
import { upsertAdCampaign } from "@/lib/services/ads.service";
import { createJob, getLatestJob, setJobStatus } from "@/lib/services/job.service";
import type { Json } from "@/types/database";

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string };

export async function runAdsJob(businessId: string): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  const existing = await getLatestJob(businessId, "ads");
  if (existing?.status === "running") return { status: "running" };

  const job = await createJob(businessId, "ads");
  await setJobStatus(job.id, "running");

  try {
    const strategy = await generateAdStrategy(business);

    for (const c of strategy.campaigns) {
      await upsertAdCampaign(businessId, {
        platform: c.platform,
        objective: c.objective,
        campaign: c.campaign as unknown as Json,
        audiences: c.audiences as unknown as Json,
        ad_copies: c.adCopies as unknown as Json,
        creatives: c.creatives as unknown as Json,
      });
    }

    await setJobStatus(job.id, "succeeded");
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobStatus(job.id, "failed", { error: message });
    return { status: "failed", error: message };
  }
}
