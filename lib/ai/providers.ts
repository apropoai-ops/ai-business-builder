import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Provider abstraction. Centralises model selection so agents stay
 * provider-agnostic and models can be swapped via environment variables.
 *
 * FREE MODE (default when GEMINI_API_KEY is set): every text agent runs on
 * Google Gemini's free API tier at $0. Claude stays wired as an automatic
 * fallback for structured runs (see fallbackForAgent + lib/ai/run.ts) and can
 * be forced back as primary with AI_PROVIDER=anthropic.
 *
 * Paid tiering (when free mode is off):
 * - reasoning → Claude (high-quality structured generation)
 * - fast      → Claude Haiku (cheap, quick tasks)
 * - embedding → OpenAI (text-embedding-3-small) for RAG
 */

// Note: this version of @ai-sdk/anthropic defaults to a base URL missing the
// "/v1" path segment, which makes every request 404. Pin the full endpoint.
// Use `||` (not `??`) so a present-but-empty env var still falls back to the
// correct "/v1" endpoint — without "/v1" the SDK hits /messages and 404s.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com/v1",
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
});

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

// Newest Gemini flash — free API tier, strong Hebrew, handles large
// structured batches (verified: full 6-item content batch, ~6.7k output tokens).
const GEMINI_MODEL = process.env.AI_GEMINI_MODEL ?? "gemini-3.6-flash";

// ⚠️ PRIVACY CONSTRAINT — read before changing anything here.
// Free mode routes every text agent to Gemini's UNPAID tier. Google's terms for
// that tier state: "Do not submit sensitive, confidential, or personal
// information to the Unpaid Services", that "human reviewers may read, annotate,
// and process your API input and output", and that submitted content is used to
// "provide, improve, and develop Google products".
//   https://ai.google.dev/gemini-api/terms
// Our prompts DO carry third-party personal data — real end-customer names and
// appointment times (daily-brief.service.ts), CRM lead names and history
// (agents/crm-followup.ts), and verbatim WhatsApp/store-chat conversations.
// Under Israeli privacy law that makes this a disclosure to a further processor
// on terms that forbid it, and it contradicts any DPA the platform signs.
// FIX: attach a billing account to the Gemini key. The paid tier excludes
// training use and is covered by Google's data processing addendum; at current
// volume it costs single-digit dollars per month.
// See docs/legal/PRIVACY-COMPLIANCE-GAPS.md §0.
//
// Free mode is on whenever a Gemini key exists, unless explicitly forced off.
const FREE_MODE =
  Boolean(process.env.GEMINI_API_KEY) &&
  (process.env.AI_PROVIDER ?? "google") !== "anthropic";

// Cost-optimized tiering (max-savings mode). Long-form reasoning runs on
// Sonnet (was Opus); mechanical/structured-extraction agents run on Haiku
// (~5x cheaper). The two highest-frequency agents (ceo-chat, whatsapp)
// already use fastModel() directly. Override per call via runStructured's
// `model` arg, or globally via the AI_*_MODEL env vars.
const REASONING_MODEL = process.env.AI_REASONING_MODEL ?? "claude-sonnet-4-6";
const FAST_MODEL = process.env.AI_FAST_MODEL ?? "claude-haiku-4-5";
const EMBEDDING_MODEL =
  process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small";

// Agents that are short, structured, or mechanical enough that Haiku is
// indistinguishable from a bigger model — route these to the cheapest tier.
const LIGHT_AGENTS = new Set<string>([
  "stock_keywords",
  "hero_style",
  "site_theme",
  "module_pick",
  "product_attributes",
  "product_gen",
  "product_image",
  "product_marketing",
  "social_media",
  "daily_brief",
  "restock",
  "sales_forecast",
  "crm_followup",
  "nav_relevance",
]);

// Heavy long-form reasoning kept on Sonnet for quality (business_plan,
// market_research, branding, website, business_insights, hr, logo_design,
// logo_options + hero_image — they author the image-model prompts, and
// prompt quality directly drives the rendered logo/hero quality).
// content + content_calendar + ads were moved BACK off Haiku (2026-07-20):
// their large structured batches were failing with "No object generated:
// could not parse the response" (output-token cap truncation — see
// lib/ai/limits.ts), and long-form marketing copy is a quality-sensitive
// deliverable that belongs on the reasoning tier anyway.

export function reasoningModel() {
  return FREE_MODE ? google(GEMINI_MODEL) : anthropic(REASONING_MODEL);
}

export function fastModel() {
  return FREE_MODE ? google(GEMINI_MODEL) : anthropic(FAST_MODEL);
}

/** Picks the cheapest adequate model for a given agent ($0 Gemini in free mode). */
export function modelForAgent(agent: string) {
  if (FREE_MODE) return google(GEMINI_MODEL);
  return anthropic(LIGHT_AGENTS.has(agent) ? FAST_MODEL : REASONING_MODEL);
}

/** The model-info label matching modelForAgent (for agent_logs). */
export function modelInfoForAgent(agent: string) {
  return LIGHT_AGENTS.has(agent) ? modelInfo.fast : modelInfo.reasoning;
}

/**
 * Paid-Claude fallback for structured runs when the free Gemini primary fails
 * (daily free quota exhausted, transient 429/5xx). Null when free mode is off
 * or no usable Anthropic key exists — the caller then just surfaces the error.
 */
export function fallbackForAgent(agent: string) {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (!FREE_MODE || key.length === 0 || key.startsWith("placeholder")) return null;
  const light = LIGHT_AGENTS.has(agent);
  return {
    model: anthropic(light ? FAST_MODEL : REASONING_MODEL),
    info: {
      provider: "anthropic",
      model: light ? FAST_MODEL : REASONING_MODEL,
    },
  };
}

export function embeddingModel() {
  return openai.embedding(EMBEDDING_MODEL);
}

export const modelInfo = {
  reasoning: FREE_MODE
    ? ({ provider: "google", model: GEMINI_MODEL } as const)
    : ({ provider: "anthropic", model: REASONING_MODEL } as const),
  fast: FREE_MODE
    ? ({ provider: "google", model: GEMINI_MODEL } as const)
    : ({ provider: "anthropic", model: FAST_MODEL } as const),
  embedding: { provider: "openai", model: EMBEDDING_MODEL },
} as const;

/** True when at least one AI provider key is configured (non-placeholder). */
export function aiConfigured() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  const geminiKey = process.env.GEMINI_API_KEY ?? "";
  return (
    geminiKey.length > 0 ||
    (anthropicKey.length > 0 && !anthropicKey.startsWith("placeholder"))
  );
}
