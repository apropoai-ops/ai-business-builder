import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

import { fastModel, modelInfo, fallbackForAgent } from "@/lib/ai/providers";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { buildWhatsappSystemPrompt } from "@/lib/ai/agents/whatsapp";
import { isOffTopicForCustomerChat, OFF_TOPIC_REPLY } from "@/lib/ai/agents/scope";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { assertChatQuota, recordChatMessage, assertUnderCostCap, addAiCost, QuotaExceededError } from "@/lib/quota";
import {
  isValidStoreSlug,
  resolveStoreChatConfig,
  getBusinessForChat,
  getWhatsappConfigForBusiness,
  fallbackWhatsappConfig,
  getOrCreateStoreChatSession,
  insertStoreChatMessage,
  getRecentStoreChatMessages,
  extractPhoneFromMessage,
  ensureLeadFromWebsiteChat,
} from "@/lib/services/store-chat.service";

// AI reply generation can take a few seconds.
export const maxDuration = 60;

const MAX_MESSAGE_LEN = 2000;

/**
 * GET /api/store-chat?slug=<slug> — cheap, cacheable widget bootstrap.
 * Returns { enabled: false } for any invalid/unpublished/disabled slug —
 * never leaks whether a slug exists.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!isValidStoreSlug(slug)) {
    return NextResponse.json({ enabled: false });
  }

  const config = await resolveStoreChatConfig(slug).catch(() => null);
  if (!config || !config.enabled) {
    return NextResponse.json(
      { enabled: false },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
    );
  }

  return NextResponse.json(
    { enabled: true, businessName: config.businessName, accent: config.accent },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}

/** Best-effort visitor IP from proxy headers (Vercel/most hosts set x-forwarded-for). */
function getVisitorIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Stable, non-reversible per-visitor key (ip hash) — never store raw IPs. */
function visitorKeyFor(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

type PostBody = { slug?: string; sessionId?: string; message?: string };

/**
 * POST /api/store-chat { slug, sessionId?, message } → { sessionId, reply }
 *
 * Mirrors the WhatsApp AI-reply path (app/api/whatsapp/webhook/route.ts):
 * same rate-limit + quota/cost-cap guards, same system-prompt builder, same
 * "persist inbound, maybe create a CRM lead, generate + persist outbound"
 * flow — non-streaming, since the widget is a simple request/response chat.
 */
export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : null;

  if (!isValidStoreSlug(slug)) {
    return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
  }
  if (!message || message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: "יש לכתוב הודעה (עד 2000 תווים)" }, { status: 400 });
  }

  const ip = getVisitorIp(request);
  if (!(await checkRateLimit(`store_chat:${slug}:${ip}`, 20, 3600))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  try {
    const config = await resolveStoreChatConfig(slug);
    if (!config || !config.enabled) {
      return NextResponse.json({ error: "הצ'אט אינו זמין כרגע" }, { status: 404 });
    }
    const { businessId } = config;

    try {
      await assertUnderCostCap(businessId);
      await assertChatQuota(businessId); // check-only; counted after success
    } catch (e) {
      const msg = e instanceof QuotaExceededError ? e.message : "השירות אינו זמין כרגע, נסו שוב מאוחר יותר";
      return NextResponse.json({ error: msg }, { status: 429 });
    }

    const visitorKey = visitorKeyFor(ip);
    const resolvedSessionId = await getOrCreateStoreChatSession(businessId, sessionId, visitorKey);

    await insertStoreChatMessage(resolvedSessionId, "user", message);

    // Unmistakably off-topic ("write me a python script") is refused BEFORE the
    // model is called: the business pays per token, and a storefront widget
    // answering coding questions under its own brand is the failure mode this
    // guards against. The prompt fence still handles everything subtler — this
    // is the narrow, high-confidence tripwire, not the whole policy.
    if (isOffTopicForCustomerChat(message)) {
      await insertStoreChatMessage(resolvedSessionId, "assistant", OFF_TOPIC_REPLY);
      return NextResponse.json({ reply: OFF_TOPIC_REPLY, sessionId: resolvedSessionId });
    }

    // Visitor shared a phone number → capture a CRM lead (fire-and-forget,
    // never blocks the reply).
    const phone = extractPhoneFromMessage(message);
    if (phone) {
      void ensureLeadFromWebsiteChat(businessId, phone, message).catch(() => {});
    }

    const [business, waConfig] = await Promise.all([
      getBusinessForChat(businessId),
      getWhatsappConfigForBusiness(businessId),
    ]);
    if (!business) {
      return NextResponse.json({ error: "עסק לא נמצא" }, { status: 404 });
    }

    const system =
      buildWhatsappSystemPrompt(business, waConfig ?? fallbackWhatsappConfig(businessId)) +
      "\n\n## הערה חשובה\nזוהי שיחת צ'אט באתר של העסק (לא וואטסאפ) — ענה בטבעיות כמו נציג שירות באתר, בלי להזכיר וואטסאפ.";

    const history = await getRecentStoreChatMessages(resolvedSessionId);
    const chatMessages = history.map((m) => ({ role: m.role, content: m.content }));

    let reply: string;
    let usedModel = modelInfo.fast.model;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    try {
      const r = await generateText({ model: fastModel(), system, messages: chatMessages });
      reply = r.text;
      usage = r.usage;
    } catch (primaryError) {
      // Free Gemini primary failed — one retry on the Claude fallback.
      const fb = fallbackForAgent("store_chat");
      if (!fb) throw primaryError;
      const r = await generateText({ model: fb.model, system, messages: chatMessages });
      reply = r.text;
      usage = r.usage;
      usedModel = fb.info.model;
    }
    // Count quota + cost only when the AI actually produced an answer — an
    // empty completion just shows the visitor a generic placeholder.
    const trimmed = reply.trim();
    if (trimmed) {
      void recordChatMessage(businessId);
      void addAiCost(
        businessId,
        estimateCostUsd(usedModel, usage?.inputTokens, usage?.outputTokens),
      );
    }

    const finalReply = trimmed || "מצטערים, לא הצלחנו לענות כרגע. אפשר לנסות לנסח שוב?";
    await insertStoreChatMessage(resolvedSessionId, "assistant", finalReply);

    return NextResponse.json({ sessionId: resolvedSessionId, reply: finalReply });
  } catch {
    return NextResponse.json({ error: "שגיאה, נסו שוב" }, { status: 500 });
  }
}
