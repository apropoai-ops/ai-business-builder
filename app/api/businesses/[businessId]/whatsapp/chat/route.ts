import { streamText } from "ai";
import { NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { fastModel, modelInfo } from "@/lib/ai/providers";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { buildWhatsappSystemPrompt } from "@/lib/ai/agents/whatsapp";
import { getBusiness } from "@/lib/services/business.service";
import { getWhatsappConfig } from "@/lib/services/whatsapp.service";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import {
  assertChatQuota,
  recordChatMessage,
  assertUnderCostCap,
  addAiCost,
  getPlanForBusiness,
  QuotaExceededError,
} from "@/lib/quota";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const maxDuration = 60;

/**
 * POST /api/businesses/:businessId/whatsapp/chat
 * Streams the WhatsApp agent's reply in the playground.
 * Body: { message: string; history: {role, content}[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { businessId } = await params;

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "whatsapp_agent")) {
    return new Response(upgradeMessage("whatsapp_agent"), { status: 403 });
  }

  if (!(await checkRateLimit(`chat:${businessId}`, 60, 3600))) {
    return new Response(RATE_LIMIT_MESSAGE, { status: 429 });
  }

  try {
    await assertUnderCostCap(businessId);
    await assertChatQuota(businessId); // check-only; counted on stream success
  } catch (e) {
    if (e instanceof QuotaExceededError) return new Response(e.message, { status: 429 });
    throw e;
  }

  const { message, history = [] } = (await request.json()) as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) return new Response("Bad Request", { status: 400 });

  const [business, config] = await Promise.all([
    getBusiness(businessId),
    getWhatsappConfig(businessId),
  ]);

  if (!business) return new Response("Not found", { status: 404 });
  if (!config) return new Response("לא הוגדר סוכן וואטסאפ", { status: 409 });

  const system = buildWhatsappSystemPrompt(business, config);

  const result = streamText({
    model: fastModel(),
    system,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ],
    onError: (error) => {
      console.error("[whatsapp-playground] stream error", error);
    },
    onFinish: ({ text, usage }) => {
      // Count quota + cost only for a non-empty reply.
      if (!text.trim()) return;
      void recordChatMessage(businessId);
      void addAiCost(
        businessId,
        estimateCostUsd(modelInfo.fast.model, usage?.inputTokens, usage?.outputTokens),
      );
    },
  });

  return result.toTextStreamResponse();
}
