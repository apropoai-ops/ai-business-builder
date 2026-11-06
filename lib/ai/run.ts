import { generateObject, type LanguageModel } from "ai";
import type { ZodType } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { modelForAgent, modelInfoForAgent, fallbackForAgent } from "@/lib/ai/providers";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { maxOutputTokensFor } from "@/lib/ai/limits";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertAiGenerationQuota, recordAiGeneration, assertUnderCostCap, addAiCost } from "@/lib/quota";

type RunStructuredArgs<T> = {
  agent: string;
  businessId: string;
  schema: ZodType<T>;
  system: string;
  prompt: string;
  model?: LanguageModel;
  modelLabel?: { provider: string; model: string };
};

/**
 * Runs a structured (JSON) generation against an LLM, validates the output
 * with the provided Zod schema, and records the call in agent_logs
 * (tokens, latency, status). Throws on failure so the caller can mark the
 * owning job as failed.
 */
export async function runStructured<T>({
  agent,
  businessId,
  schema,
  system,
  prompt,
  model,
  modelLabel,
}: RunStructuredArgs<T>): Promise<T> {
  const startedAt = Date.now();
  const usedModel = model ?? modelForAgent(agent);
  const label = modelLabel ?? modelInfoForAgent(agent);

  // Single choke point for every structured AI generation in the system:
  // hourly rate limit (burst protection) + monthly plan quota.
  const allowed = await checkRateLimit(`ai_gen:${businessId}`, 20, 3600);
  if (!allowed) {
    throw new Error("חרגתם ממכסת ייצור ה-AI לשעה זו — נסו שוב בעוד כשעה");
  }
  await assertUnderCostCap(businessId); // throws QuotaExceededError at the $ cap
  await assertAiGenerationQuota(businessId); // check-only; bumped after success

  const attempt = async (
    m: LanguageModel,
    lbl: { provider: string; model: string },
  ): Promise<T> => {
    const result = await generateObject({
      model: m,
      schema,
      system,
      prompt,
      maxOutputTokens: maxOutputTokensFor(agent),
    });

    await logAgentCall({
      agent,
      businessId,
      label: lbl,
      status: "succeeded",
      latencyMs: Date.now() - startedAt,
      tokensIn: result.usage?.inputTokens,
      tokensOut: result.usage?.outputTokens,
    });

    // Count the quota unit + estimated spend only for a SUCCESSFUL generation
    // (failed attempts must not burn the user's monthly quota).
    await recordAiGeneration(businessId);
    await addAiCost(
      businessId,
      estimateCostUsd(lbl.model, result.usage?.inputTokens, result.usage?.outputTokens),
    );

    return result.object;
  };

  try {
    return await attempt(usedModel, label);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgentCall({
      agent,
      businessId,
      label,
      status: "failed",
      latencyMs: Date.now() - startedAt,
      error: message,
    });

    // Free-mode resilience: when the free Gemini primary fails (daily quota,
    // transient 429/5xx), retry once on the paid Claude fallback — but only
    // when the caller didn't pin a specific model.
    const fallback = model ? null : fallbackForAgent(agent);
    if (fallback) {
      try {
        return await attempt(fallback.model, fallback.info);
      } catch (fallbackError) {
        const fbMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        await logAgentCall({
          agent,
          businessId,
          label: fallback.info,
          status: "failed",
          latencyMs: Date.now() - startedAt,
          error: fbMessage,
        });
        throw new Error(`AI generation failed (${agent}): ${fbMessage}`);
      }
    }

    throw new Error(`AI generation failed (${agent}): ${message}`);
  }
}

async function logAgentCall(args: {
  agent: string;
  businessId: string;
  label: { provider: string; model: string };
  status: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}) {
  try {
    const supabase = createServiceRoleClient();
    await supabase.from("agent_logs").insert({
      business_id: args.businessId,
      agent: args.agent,
      provider: args.label.provider,
      model: args.label.model,
      tokens_in: args.tokensIn ?? null,
      tokens_out: args.tokensOut ?? null,
      latency_ms: args.latencyMs,
      status: args.status,
      error: args.error ?? null,
    });
  } catch {
    // Logging must never break the main flow.
  }
}
