import { generateSocialStrategy } from "@/lib/ai/agents/social-media";
import { getBusiness } from "@/lib/services/business.service";
import { upsertSocialProfile } from "@/lib/services/social-media.service";
import { createJob, getLatestJob, setJobStatus } from "@/lib/services/job.service";
import type { Json } from "@/types/database";

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string };

export async function runSocialMediaJob(businessId: string): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  const existing = await getLatestJob(businessId, "social_media");
  if (existing?.status === "running") return { status: "running" };

  const job = await createJob(businessId, "social_media");
  await setJobStatus(job.id, "running");

  try {
    const strategy = await generateSocialStrategy(business);

    for (const p of strategy.profiles) {
      await upsertSocialProfile(businessId, {
        platform: p.platform,
        bio: p.bio,
        content_pillars: p.contentPillars as unknown as Json,
        posting_frequency: p.postingFrequency,
        best_times: p.bestTimes as unknown as Json,
        hashtag_sets: p.hashtagSets as unknown as Json,
        sample_posts: p.samplePosts as unknown as Json,
        growth_tips: p.growthTips as unknown as Json,
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
