import { streamText } from "ai";
import { NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { fastModel, modelInfo } from "@/lib/ai/providers";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { buildCeoSystemPrompt } from "@/lib/ai/agents/ceo-chat";
import { getBusiness, getBusinessProfile } from "@/lib/services/business.service";
import { getMarketResearch } from "@/lib/services/market-research.service";
import { getBrandAssets } from "@/lib/services/branding.service";
import { listLeads, listDeals, listTasks } from "@/lib/services/crm.service";
import { saveMessage, getCeoSalesContext } from "@/lib/services/ceo-chat.service";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { assertChatQuota, recordChatMessage, assertUnderCostCap, addAiCost, QuotaExceededError } from "@/lib/quota";

export const maxDuration = 60;

/**
 * POST /api/businesses/:businessId/ceo-chat
 * Streams a CEO response. Body: { message: string; history: {role, content}[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { businessId } = await params;

  if (!(await checkRateLimit(`chat:${businessId}`, 60, 3600))) {
    return new Response(RATE_LIMIT_MESSAGE, { status: 429 });
  }

  try {
    await assertUnderCostCap(businessId);
    await assertChatQuota(businessId); // check-only; bumped on stream success
  } catch (e) {
    if (e instanceof QuotaExceededError) return new Response(e.message, { status: 429 });
    throw e;
  }

  const { message, history = [] } = await request.json() as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) return new Response("Bad Request", { status: 400 });

  // Load all business context in parallel
  const [business, profile, research, brand, leads, deals, tasks, sales] =
    await Promise.all([
      getBusiness(businessId),
      getBusinessProfile(businessId),
      getMarketResearch(businessId),
      getBrandAssets(businessId),
      listLeads(businessId),
      listDeals(businessId),
      listTasks(businessId),
      getCeoSalesContext(businessId).catch(() => null),
    ]);

  if (!business) return new Response("Not found", { status: 404 });

  const system = buildCeoSystemPrompt({ business, profile, research, brand, leads, deals, tasks, sales });

  // Save user message (fire-and-forget — don't block the stream)
  saveMessage(businessId, "user", message).catch(() => {});

  const result = streamText({
    model: fastModel(),
    system,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ],
    onError: (error) => {
      // The free Gemini primary can 429/5xx — surface it in logs (the client
      // detects the empty stream and shows a retry message).
      console.error("[ceo-chat] stream error", error);
    },
    onFinish: ({ text, usage }) => {
      // Only count the quota unit + cost when a real answer was produced.
      if (!text.trim()) return;
      saveMessage(businessId, "assistant", text).catch(() => {});
      void recordChatMessage(businessId);
      void addAiCost(
        businessId,
        estimateCostUsd(modelInfo.fast.model, usage?.inputTokens, usage?.outputTokens),
      );
    },
  });

  return result.toTextStreamResponse();
}
