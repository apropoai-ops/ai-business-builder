import { generateBranding } from "@/lib/ai/agents/branding";
import { getBusiness } from "@/lib/services/business.service";
import { upsertBrandAssets } from "@/lib/services/branding.service";
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

export async function runBrandingJob(businessId: string): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  let job = await getLatestJob(businessId, "branding");
  if (job && (job.status === "running" || job.status === "succeeded")) {
    return job.status === "running"
      ? { status: "running" }
      : { status: "skipped", reason: "כבר הושלם" };
  }
  if (!job) job = await createJob(businessId, "branding");

  await setJobStatus(job.id, "running");

  try {
    const data = await generateBranding(business);

    await upsertBrandAssets(businessId, {
      brand_name: data.brandName,
      slogan: data.slogan,
      mission: data.mission,
      vision: data.vision,
      personality: data.personality as unknown as Json,
      brand_voice: data.brandVoice,
      color_palette: data.colorPalette as unknown as Json,
      typography: data.typography as unknown as Json,
      logo_prompt: data.logoPrompt,
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
