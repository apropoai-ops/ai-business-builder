import { generateBusinessPlan } from "@/lib/ai/agents/business-plan";
import {
  getBusiness,
  setBusinessStatus,
  upsertBusinessProfile,
} from "@/lib/services/business.service";
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

/**
 * Processes the business-plan generation for a business. Idempotent: safe to
 * call multiple times — it will not re-run a job that is already running or
 * has succeeded. Must be invoked from an authenticated server context
 * (RLS scopes all access to the owner).
 */
export async function runBusinessPlanJob(businessId: string): Promise<RunResult> {
  const business = await getBusiness(businessId);
  if (!business) {
    return { status: "failed", error: "העסק לא נמצא" };
  }

  // Find or create the job for this generation.
  let job = await getLatestJob(businessId, "business_plan");
  if (job && (job.status === "running" || job.status === "succeeded")) {
    return { status: job.status === "running" ? "running" : "skipped", reason: "כבר רץ או הושלם" } as RunResult;
  }
  if (!job) {
    job = await createJob(businessId, "business_plan");
  }

  // Mark as running.
  await setJobStatus(job.id, "running");
  await setBusinessStatus(businessId, "generating");

  try {
    const plan = await generateBusinessPlan(business);

    await upsertBusinessProfile(businessId, {
      executive_summary: plan.executiveSummary,
      business_model: plan.businessModel as unknown as Json,
      value_proposition: plan.valueProposition,
      revenue_streams: plan.revenueStreams as unknown as Json,
      customer_segments: plan.customerSegments as unknown as Json,
      pricing_strategy: plan.pricingStrategy as unknown as Json,
      launch_plan: plan.launchPlan as unknown as Json,
      generated_at: new Date().toISOString(),
    });

    await setBusinessStatus(businessId, "ready");
    await setJobStatus(job.id, "succeeded");
    return { status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobStatus(job.id, "failed", { error: message });
    // Leave the business in 'generating' so the user can retry.
    return { status: "failed", error: message };
  }
}
