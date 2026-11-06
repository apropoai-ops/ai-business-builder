import crypto from "node:crypto";
import { openWhatsappSecret } from "@/lib/whatsapp-secrets";
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

import { fastModel, modelInfo, fallbackForAgent } from "@/lib/ai/providers";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { buildWhatsappSystemPrompt } from "@/lib/ai/agents/whatsapp";
import { sendWhatsappText } from "@/lib/services/whatsapp-api";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertChatQuota, recordChatMessage, assertUnderCostCap, addAiCost } from "@/lib/quota";
import {
  findConfigByPhoneNumberId,
  getBusinessById,
  upsertConversation,
  insertWhatsappMessage,
  getRecentMessages,
  ensureLeadFromContact,
  flagConversationForFollowUp,
  inboundMessageAlreadyProcessed,
} from "@/lib/services/whatsapp-webhook.service";

// AI reply generation can take a few seconds.
export const maxDuration = 60;

/**
 * GET — Meta webhook verification handshake.
 * Meta calls this once with hub.mode/hub.verify_token/hub.challenge.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Verifies the X-Hub-Signature-256 header against one candidate app secret. */
function signatureMatches(raw: string, signature: string, appSecret: string): boolean {
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Which app secret should have signed this payload.
 *
 * Every customer connects their OWN Meta app — that is how they get a Phone
 * Number ID and a token in the first place — so each one signs with a
 * different app secret. Verifying against a single WHATSAPP_APP_SECRET meant
 * every real customer's messages failed the HMAC and were rejected 401, with
 * nothing surfaced anywhere: the agent just never answered. So the business's
 * own secret is used when set; the env var is ONLY the fallback for a number
 * connected through our own app (no business-specific secret on file) — once
 * a business has its own secret, the global one no longer applies to it, or
 * anyone holding the shared env secret could forge messages for every
 * business that HAS configured its own.
 */
function candidateSecrets(businessSecret: string | null | undefined): string[] {
  const own = businessSecret?.trim();
  if (own) return [own];
  const shared = process.env.WHATSAPP_APP_SECRET?.trim();
  return shared ? [shared] : [];
}

type IncomingMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
};

/**
 * POST — incoming message events. Always returns 200 quickly so Meta does not
 * retry; per-message failures are swallowed (and could be logged).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Parsing before verifying is safe — the signature is checked below, once we
  // know which business (and therefore which app secret) the payload claims to
  // be from, and nothing is persisted or answered until it passes.
  try {
    await handleWebhookPayload(body, raw, signature);
  } catch {
    // Never fail the webhook — Meta would retry endlessly.
  }

  return NextResponse.json({ ok: true });
}

async function handleWebhookPayload(
  body: unknown,
  raw: string,
  signature: string | null,
): Promise<void> {
  const entries = (body as { entry?: unknown[] })?.entry ?? [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;

      const messages = (value.messages as IncomingMessage[] | undefined) ?? [];
      if (messages.length === 0) continue; // status updates etc.

      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      const phoneNumberId = metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const config = await findConfigByPhoneNumberId(phoneNumberId);
      if (!config || !config.access_token) continue;

      // Now that we know whose number this is, prove the payload really came
      // from that Meta app before touching the database or replying. Fail
      // CLOSED — an unconfigured secret must reject, not silently trust the
      // payload, or anyone who learns a business's phone_number_id (visible
      // in Meta's own delivered payloads, not secret) could forge messages
      // for it until the owner finishes connecting their app secret.
      const secrets = candidateSecrets(openWhatsappSecret(config.app_secret));
      if (secrets.length === 0) {
        console.warn(
          `[whatsapp] no app secret configured for phone_number_id=${phoneNumberId} — rejecting unverifiable payload`,
        );
        continue;
      }
      const ok = signature && secrets.some((s) => signatureMatches(raw, signature, s));
      if (!ok) {
        // Loud on purpose: a silently dropped message is indistinguishable
        // from a dead agent, which is exactly how this failure used to look.
        console.warn(
          `[whatsapp] signature check failed for phone_number_id=${phoneNumberId} — the App Secret saved for this business does not match the app that sent the event`,
        );
        continue;
      }

      const business = await getBusinessById(config.business_id);
      if (!business) continue;

      const contacts =
        (value.contacts as { profile?: { name?: string }; wa_id?: string }[] | undefined) ?? [];
      const contactName = contacts[0]?.profile?.name ?? null;

      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        // Meta redelivers the webhook on a slow response (AI generation +
        // send can take seconds) — without this, a redelivery of the same
        // message id generates and sends a second AI reply to the customer.
        if (await inboundMessageAlreadyProcessed(business.id, msg.id)) continue;

        const from = msg.from;
        const text = msg.text.body;

        // Persist inbound + lead + conversation
        const conversation = await upsertConversation(
          business.id,
          from,
          contactName,
        );
        await ensureLeadFromContact(business.id, from, contactName);
        await insertWhatsappMessage({
          businessId: business.id,
          conversationId: conversation.id,
          direction: "inbound",
          content: text,
          waMessageId: msg.id,
        });

        // Queue it for the owner regardless of what the agent does next. The
        // agent handles the conversation; it does not close the loop — a
        // quoted price, a booking, a complaint all still need a human. Placed
        // before the `enabled` check on purpose: a paused agent means the
        // customer is waiting on the owner and nobody else.
        await flagConversationForFollowUp({
          conversationId: conversation.id,
          businessId: business.id,
          contactName,
          contactPhone: from,
          lastMessage: text,
        });

        if (!config.enabled) continue; // agent paused — log only, don't reply

        // Guard against bot loops / floods burning AI credits.
        if (!(await checkRateLimit(`wa_reply:${business.id}`, 60, 3600))) continue;

        // Monthly plan quota + cost cap — inbound is stored either way; only
        // the AI reply is skipped when the owner is over quota or the business
        // has hit its monthly cost ceiling. Check-only: the quota unit is
        // counted only after a reply is actually generated.
        try {
          await assertUnderCostCap(business.id);
          await assertChatQuota(business.id);
        } catch {
          continue;
        }

        // Per-message isolation: Meta batches multiple messages (and multiple
        // customers) into one webhook payload — one failing reply must not
        // abort the rest of the batch. The inbound message + lead are already
        // stored above either way.
        try {
          // Generate the AI reply with full conversation history
          const history = await getRecentMessages(conversation.id);
          const system = buildWhatsappSystemPrompt(business, config);
          const chatMessages = history.map((m) => ({ role: m.role, content: m.content }));

          let reply: string;
          let usedModel = modelInfo.fast.model;
          let usage: { inputTokens?: number; outputTokens?: number } | undefined;
          try {
            const r = await generateText({ model: fastModel(), system, messages: chatMessages });
            reply = r.text;
            usage = r.usage;
          } catch (primaryError) {
            // Free Gemini primary failed (daily quota / transient 429) — one
            // retry on the Claude fallback so a real customer isn't dropped.
            const fb = fallbackForAgent("whatsapp");
            if (!fb) throw primaryError;
            const r = await generateText({ model: fb.model, system, messages: chatMessages });
            reply = r.text;
            usage = r.usage;
            usedModel = fb.info.model;
          }

          // An empty/whitespace reply (safety-filtered or refused generation)
          // is a no-op — don't charge the owner's quota/cost for a message the
          // customer never receives.
          if (!reply.trim()) continue;

          void recordChatMessage(business.id);
          void addAiCost(
            business.id,
            estimateCostUsd(usedModel, usage?.inputTokens, usage?.outputTokens),
          );

          // Send, then persist outbound ONLY if it actually reached Meta — a
          // failed send (expired token, rate limit) must not be recorded as a
          // delivered reply, or the conversation view lies about what the
          // customer received. The inbound flag above already keeps this
          // conversation queued for the owner either way.
          const sent = await sendWhatsappText({
            phoneNumberId,
            accessToken: openWhatsappSecret(config.access_token) ?? "",
            to: from,
            body: reply,
          });
          if (!sent.ok) {
            console.warn(
              `[whatsapp] send failed for business=${business.id} conversation=${conversation.id}: ${sent.error}`,
            );
            continue;
          }
          await insertWhatsappMessage({
            businessId: business.id,
            conversationId: conversation.id,
            direction: "outbound",
            content: reply,
            waMessageId: sent.messageId,
          });
        } catch {
          // This message's reply failed — move on to the next one.
          continue;
        }
      }
    }
  }
}
