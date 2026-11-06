import { generateWhatsappSetup } from "@/lib/ai/agents/whatsapp";
import { getBusiness } from "@/lib/services/business.service";
import { getWhatsappConfig, upsertWhatsappConfig } from "@/lib/services/whatsapp.service";
import { createJob, getLatestJob, setJobStatus } from "@/lib/services/job.service";
import type { Json } from "@/types/database";

export type RunResult =
  | { status: "succeeded" }
  | { status: "running" }
  | { status: "failed"; error: string };

export async function runWhatsappSetupJob(businessId: string): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) return { status: "failed", error: "העסק לא נמצא" };

  const existing = await getLatestJob(businessId, "whatsapp");
  if (existing?.status === "running") return { status: "running" };

  const job = await createJob(businessId, "whatsapp");
  await setJobStatus(job.id, "running");

  try {
    const setup = await generateWhatsappSetup(business);

    // Preserve a manually-set enabled flag if a config already exists.
    const current = await getWhatsappConfig(businessId);

    await upsertWhatsappConfig(businessId, {
      greeting: setup.greeting,
      tone: setup.tone,
      goals: setup.goals as unknown as Json,
      faq: setup.faq as unknown as Json,
      enabled: current?.enabled ?? true,
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
