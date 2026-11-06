import { generateContent } from "@/lib/ai/agents/content";
import { getBusiness } from "@/lib/services/business.service";
import { insertContentItems } from "@/lib/services/content.service";
import { createJob, getLatestJob, setJobStatus } from "@/lib/services/job.service";

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string };

export async function runContentJob(
  businessId: string,
  topic: string,
): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  // Skip if already running (but allow re-generation after success).
  const existing = await getLatestJob(businessId, "content");
  if (existing?.status === "running") return { status: "running" };

  const job = await createJob(businessId, "content", { topic });
  await setJobStatus(job.id, "running");

  try {
    const batch = await generateContent(business, topic);

    await insertContentItems(
      businessId,
      batch.items.map((item) => ({
        type: item.type,
        title: item.title ?? null,
        content: item.content,
        hashtags: item.hashtags,
        cta: item.cta ?? null,
        topic,
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
