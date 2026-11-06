# AI Business Builder — TECHNICAL MASTERPLAN

> מסמך תכנון טכני מלא ל־**Phase 1 (MVP)**
> נכתב על ידי: CTO (תכנון אדריכלי)
> סטטוס: **טיוטה לאישור — אין לכתוב קוד לפני אישור**
> גרסה: 1.0 · תאריך: 2026-06-09

---

## 0. תקציר מנהלים (Executive Summary)

המטרה של Phase 1 היא להפוך **רעיון עסקי** למוצר עסקי מוכן להשקה. המשתמש מתאר עסק בכמה משפטים, והמערכת מייצרת עבורו: תוכנית עסקית, מחקר שוק, חבילת מיתוג, אתר, מערכת CRM, וצ'אט עם "AI CEO" שמכיר את כל ההקשר העסקי שלו.

עקרונות הליבה של התכנון:

1. **Vertical Slices** — כל פיצ'ר נבנה מקצה לקצה (DB → API → UI → AI) לפני שעוברים לבא.
2. **Multi-tenant מהיסוד** — כל שורה במסד הנתונים שייכת ל־`business_id`, עם בידוד מלא דרך Row Level Security.
3. **AI כשכבה מודולרית** — כל "סוכן" הוא מודול עצמאי עם חוזה (contract) ברור, ניתן להחלפה בין ספקי AI.
4. **ללא פתרונות זמניים** — אבטחה, ולידציה, וטיפול בשגיאות מהיום הראשון.
5. **מוכן ל־10K+ משתמשים** — Stateless API, תורי עבודה אסינכרוניים למשימות AI כבדות, caching.

### היקף Phase 1 — 6 פיצ'רים

| # | פיצ'ר | תיאור |
|---|-------|-------|
| F1 | Business Creation Wizard | אשף קליטת רעיון → תוכנית עסקית |
| F2 | Market Research Engine | מתחרים, SWOT, הזדמנויות, מיצוב |
| F3 | Branding Engine | שם, סלוגן, צבעים, טיפוגרפיה, Brand Book |
| F4 | Website Generator | אתר רב־עמודים, רספונסיבי, ניתן לעריכה |
| F5 | CRM | Leads, Customers, Tasks, Deals + Pipeline |
| F6 | AI CEO Chat | צ'אט עם הקשר עסקי מלא (RAG) |

מה שמחוץ ל־Phase 1 (לא ייבנה כעת): Marketing Automation, Ads, Analytics מתקדם, Operations, HR.

---

## 1. ארכיטקטורת מערכת (System Architecture)

### 1.1 תרשים שכבות (High-Level)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│   Next.js 15 App Router · React · TypeScript · Tailwind ·     │
│   ShadCN UI · React Query (server-state) · Zustand (ui-state) │
└───────────────┬─────────────────────────────┬───────────────┘
                │ HTTPS                         │ Supabase JS SDK
                │ (Server Actions / Route       │ (Auth, Realtime,
                │  Handlers)                     │  Storage)
┌───────────────▼─────────────────────────────▼───────────────┐
│                   APPLICATION LAYER (Vercel)                  │
│  Next.js Server Components · Server Actions · Route Handlers  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Auth Guard  │  │  Validation  │  │  Rate Limiting    │    │
│  │  (middleware)│  │  (Zod)       │  │  (Upstash Redis)  │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SERVICE LAYER (lib/services)             │    │
│  │  business · research · branding · website · crm ·    │    │
│  │  chat · billing                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              AI ORCHESTRATION LAYER                   │    │
│  │  Agent Router → [CEO, Marketing, Branding, ...]       │    │
│  │  Provider Abstraction (OpenAI | Anthropic)           │    │
│  └─────────────────────────────────────────────────────┘    │
└───────┬─────────────────────┬───────────────────┬───────────┘
        │                     │                   │
┌───────▼────────┐   ┌────────▼────────┐  ┌───────▼──────────┐
│   SUPABASE     │   │  AI PROVIDERS    │  │   STRIPE         │
│  PostgreSQL    │   │  OpenAI GPT      │  │   Billing /      │
│  Auth + RLS    │   │  Anthropic Claude│  │   Webhooks       │
│  Storage       │   │                  │  │                  │
│  pgvector      │   └──────────────────┘  └──────────────────┘
│  Realtime      │
└────────────────┘
        │
┌───────▼─────────────────────────────────┐
│   ASYNC JOBS (Supabase Edge Functions /  │
│   Vercel background + queue table)        │
│   משימות AI כבדות: אתר, מחקר שוק, מיתוג   │
└──────────────────────────────────────────┘
```

### 1.2 החלטות אדריכליות מרכזיות (ADRs)

| # | החלטה | נימוק | חלופה שנדחתה |
|---|-------|-------|--------------|
| ADR-1 | **Server Actions + Route Handlers** ב־Next.js במקום API נפרד | פחות boilerplate, type-safety מקצה לקצה, מתאים ל-Vercel | NestJS נפרד — overkill ל-MVP |
| ADR-2 | **Supabase כ-DB+Auth+Storage** | פתרון מנוהל, RLS מובנה, pgvector ל-RAG | Firebase — פחות טוב ל-SQL יחסי |
| ADR-3 | **Provider Abstraction Layer ל-AI** | אפשרות להחליף OpenAI/Claude לפי משימה ועלות | קריאה ישירה — נועל ספק |
| ADR-4 | **Async Queue למשימות AI ארוכות** | יצירת אתר/מחקר לוקחת 30-90 שניות → לא חוסם בקשת HTTP | סנכרוני — timeout ו-UX גרוע |
| ADR-5 | **RAG עם pgvector ל-AI CEO** | הצ'אט צריך הקשר עסקי מלא ללא חריגה מ-context window | הזרקת כל ה-DB ל-prompt — יקר ולא סקיילבילי |
| ADR-6 | **Multi-tenant ברמת שורה (RLS)** | בידוד מוחלט בין עסקים, אבטחה ב-DB ולא רק באפליקציה | Schema-per-tenant — מורכב מדי |

### 1.3 בחירות טכנולוגיה סופיות

```
Frontend:    Next.js 15 (App Router), React 19, TypeScript 5,
             TailwindCSS (RTL via logical properties), ShadCN/UI,
             React Query, Zustand, react-hook-form + Zod,
             Lucide icons, Recharts
             ★ שפת ממשק: עברית (dir="rtl") כברירת מחדל
             ★ פונט: Heebo / Assistant (Google Fonts, תמיכה מלאה בעברית)

Backend:     Next.js Server Actions/Route Handlers,
             Supabase (PostgreSQL 15, Auth, Storage, Realtime, pgvector)

AI:          Vercel AI SDK (streaming), OpenAI SDK, Anthropic SDK,
             Provider Abstraction (lib/ai/providers)

Infra:       Vercel (hosting + cron), Supabase Cloud,
             Upstash Redis (rate-limit + cache)

Payments:    Stripe (Checkout + Customer Portal + Webhooks)

Tooling:     pnpm, ESLint, Prettier, Vitest (unit),
             Playwright (e2e), Drizzle/Supabase migrations,
             Sentry (errors), PostHog (analytics — optional)
```

---

## 2. מבנה תיקיות (Folder Structure)

```
ai-business-builder/
├── app/                              # Next.js App Router
│   ├── (marketing)/                  # דפי נחיתה ציבוריים
│   │   ├── page.tsx                  # Landing
│   │   ├── pricing/
│   │   └── layout.tsx
│   ├── (auth)/                       # אימות
│   │   ├── login/
│   │   ├── signup/
│   │   ├── reset-password/
│   │   └── callback/
│   ├── (dashboard)/                  # אזור מחובר — מוגן
│   │   ├── layout.tsx                # Sidebar + Auth guard
│   │   ├── businesses/
│   │   │   ├── page.tsx              # רשימת עסקים
│   │   │   ├── new/                  # F1: Wizard
│   │   │   └── [businessId]/
│   │   │       ├── overview/         # Dashboard לעסק
│   │   │       ├── plan/             # F1: תוכנית עסקית
│   │   │       ├── research/         # F2: מחקר שוק
│   │   │       ├── branding/         # F3: מיתוג
│   │   │       ├── website/          # F4: אתר
│   │   │       ├── crm/              # F5: CRM
│   │   │       │   ├── leads/
│   │   │       │   ├── customers/
│   │   │       │   ├── deals/        # Pipeline
│   │   │       │   └── tasks/
│   │   │       └── ceo-chat/         # F6: AI CEO
│   │   └── settings/
│   │       ├── profile/
│   │       ├── billing/              # Stripe portal
│   │       └── team/
│   ├── api/                          # Route Handlers
│   │   ├── ai/
│   │   │   ├── chat/route.ts         # streaming CEO chat
│   │   │   └── generate/route.ts
│   │   ├── webhooks/
│   │   │   └── stripe/route.ts
│   │   └── jobs/
│   │       └── [jobId]/route.ts      # polling סטטוס משימה
│   ├── layout.tsx                    # Root layout
│   └── globals.css
│
├── components/
│   ├── ui/                           # ShadCN primitives
│   ├── wizard/                       # רכיבי האשף
│   ├── crm/                          # Kanban, tables
│   ├── chat/                         # chat UI
│   ├── branding/                     # color palette, preview
│   └── shared/                       # Navbar, Sidebar, EmptyState
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # browser client
│   │   ├── server.ts                 # server client (RSC)
│   │   └── middleware.ts             # session refresh
│   ├── ai/
│   │   ├── providers/                # openai.ts, anthropic.ts
│   │   ├── agents/                   # ceo, branding, research...
│   │   ├── prompts/                  # prompt templates
│   │   ├── schemas/                  # Zod schemas ל-output
│   │   └── orchestrator.ts           # Agent Router
│   ├── services/                     # Business logic
│   │   ├── business.service.ts
│   │   ├── research.service.ts
│   │   ├── branding.service.ts
│   │   ├── website.service.ts
│   │   ├── crm.service.ts
│   │   ├── chat.service.ts
│   │   └── billing.service.ts
│   ├── jobs/                         # async queue
│   │   ├── queue.ts
│   │   └── handlers/
│   ├── validation/                   # Zod schemas
│   ├── auth/                         # guards, helpers
│   ├── rate-limit.ts
│   └── utils.ts
│
├── supabase/
│   ├── migrations/                   # SQL migrations
│   ├── seed.sql
│   └── functions/                    # Edge Functions
│
├── types/                            # TypeScript types (DB generated)
├── tests/                            # Vitest + Playwright
├── .env.example
├── middleware.ts                     # auth + rate-limit globally
└── package.json
```

**עקרון:** הפרדה נקייה בין שכבות — UI לא קורא ל-DB ישירות, אלא דרך `services`. ה-`services` קוראים ל-`supabase` ול-`ai`. זה מאפשר בדיקות, החלפת ספקים, ותחזוקה.

---

## 3. מסד נתונים — ERD ומבנה טבלאות

### 3.1 ERD (תרשים יחסים)

```
                            ┌──────────────┐
                            │    users     │  (Supabase auth.users)
                            │  id (uuid)   │
                            └──────┬───────┘
                                   │ 1
                                   │
                            ┌──────▼────────┐
                            │   profiles    │  1:1 עם user
                            │  id, full_name│
                            │  plan, ...    │
                            └──────┬────────┘
                                   │ 1
                                   │ owns
                                   │ N
                  ┌────────────────▼─────────────────┐
                  │           businesses              │  ← TENANT ROOT
                  │  id, owner_id, name, type, ...    │
                  └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──────┘
        1:1 ┌────────┘  │  │  │  │  │  │  │  │  └────────┐ 1:N
            ▼           │  │  │  │  │  │  │  │           ▼
  ┌──────────────────┐ │  │  │  │  │  │  │  │  ┌──────────────────┐
  │ business_profiles│ │  │  │  │  │  │  │  │  │   agent_logs     │
  │ (business plan)  │ │  │  │  │  │  │  │  │  └──────────────────┘
  └──────────────────┘ │  │  │  │  │  │  │  │
       1:1 ┌───────────┘  │  │  │  │  │  │  └───────┐ 1:N
           ▼              │  │  │  │  │  │          ▼
  ┌──────────────────┐   │  │  │  │  │  │  ┌──────────────────┐
  │  market_research │   │  │  │  │  │  │  │  chat_threads    │
  └──────────────────┘   │  │  │  │  │  │  └────────┬─────────┘
      1:1 ┌──────────────┘  │  │  │  │  │           │ 1:N
          ▼                 │  │  │  │  │           ▼
  ┌──────────────────┐      │  │  │  │  │  ┌──────────────────┐
  │   brand_assets   │      │  │  │  │  │  │  chat_messages   │
  └──────────────────┘      │  │  │  │  │  └──────────────────┘
      1:1 ┌─────────────────┘  │  │  │  │
          ▼                    │  │  │  │
  ┌──────────────────┐         │  │  │  │   ┌────────────────────┐
  │     websites     │         │  │  │  │   │ business_embeddings│ (RAG)
  │  + website_pages │         │  │  │  │   │ pgvector           │
  └──────────────────┘         │  │  │  │   └────────────────────┘
                  1:N ┌─────────┘  │  │  └──────────┐ 1:N
                      ▼            │  │             ▼
            ┌──────────────┐  1:N  │  │     ┌──────────────┐
            │  crm_leads   │       │  │     │  crm_deals   │
            └──────┬───────┘       │  │     └──────────────┘
                   │ converts to   │  └──────────┐ 1:N
                   ▼               ▼             ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │crm_customers │ │  crm_tasks   │ │ subscriptions│
            └──────────────┘ └──────────────┘ └──────────────┘
```

### 3.2 רשימת טבלאות מלאה (Phase 1)

| טבלה | תיאור | מפתח Tenant |
|------|-------|-------------|
| `profiles` | פרופיל משתמש (מרחיב את auth.users) | `id` = user |
| `businesses` | **שורש ה-tenant** — כל עסק | `id` |
| `business_profiles` | תוכנית עסקית (F1) | `business_id` |
| `market_research` | מחקר שוק + SWOT (F2) | `business_id` |
| `brand_assets` | מיתוג (F3) | `business_id` |
| `websites` | מטא-דאטה של אתר (F4) | `business_id` |
| `website_pages` | עמודי אתר (F4) | `business_id` |
| `crm_leads` | לידים (F5) | `business_id` |
| `crm_customers` | לקוחות (F5) | `business_id` |
| `crm_deals` | עסקאות + pipeline (F5) | `business_id` |
| `crm_tasks` | משימות (F5) | `business_id` |
| `chat_threads` | שיחות AI CEO (F6) | `business_id` |
| `chat_messages` | הודעות בשיחה (F6) | `business_id` |
| `business_embeddings` | וקטורים ל-RAG (F6) | `business_id` |
| `agent_logs` | לוג קריאות AI (עלות, טוקנים, latency) | `business_id` |
| `jobs` | תור משימות אסינכרוניות | `business_id` |
| `subscriptions` | מנוי Stripe | `user_id` |
| `usage_counters` | מונה שימוש לפי plan (quota) | `business_id` |

### 3.3 פירוט סכמה מרכזית (DDL מתוכנן — לא לביצוע עדיין)

```sql
-- ENUMS
create type plan_tier      as enum ('free', 'starter', 'pro', 'business');
create type business_status as enum ('draft', 'generating', 'ready', 'archived');
create type lead_status    as enum ('new','contacted','qualified','proposal','won','lost');
create type deal_stage     as enum ('lead','qualified','proposal','negotiation','won','lost');
create type task_status    as enum ('todo','in_progress','done','cancelled');
create type job_status     as enum ('queued','running','succeeded','failed');
create type job_type       as enum ('business_plan','market_research','branding','website');

-- PROFILES (1:1 with auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  plan        plan_tier not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- BUSINESSES (tenant root)
create table businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text,
  type          text,
  industry      text,
  location      text,
  target_audience text,
  budget        numeric,
  revenue_goal  numeric,
  description   text not null,
  status        business_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on businesses (owner_id);

-- BUSINESS_PROFILES (F1 output)
create table business_profiles (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null unique references businesses(id) on delete cascade,
  executive_summary text,
  business_model    jsonb,
  value_proposition text,
  revenue_streams   jsonb,
  customer_segments jsonb,
  pricing_strategy  jsonb,
  launch_plan       jsonb,
  generated_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- MARKET_RESEARCH (F2)
create table market_research (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null unique references businesses(id) on delete cascade,
  competitors   jsonb,   -- [{name, strengths, weaknesses, opportunities}]
  swot          jsonb,   -- {strengths, weaknesses, opportunities, threats}
  opportunities jsonb,
  positioning   text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- BRAND_ASSETS (F3)
create table brand_assets (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null unique references businesses(id) on delete cascade,
  brand_name    text,
  slogan        text,
  mission       text,
  vision        text,
  personality   jsonb,
  color_palette jsonb,   -- [{name, hex, role}]
  typography    jsonb,   -- {heading, body}
  logo_prompt   text,
  logo_url      text,    -- Supabase Storage
  brand_book    jsonb,
  generated_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- WEBSITES + PAGES (F4)
create table websites (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null unique references businesses(id) on delete cascade,
  theme         jsonb,    -- מתבסס על brand_assets
  seo           jsonb,    -- {title, description, keywords}
  published     boolean not null default false,
  slug          text unique,
  created_at    timestamptz not null default now()
);
create table website_pages (
  id          uuid primary key default gen_random_uuid(),
  website_id  uuid not null references websites(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  type        text not null,  -- home|about|services|contact|faq|blog
  title       text,
  content     jsonb,          -- structured blocks (editable)
  seo         jsonb,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- CRM (F5)
create table crm_leads (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  status      lead_status not null default 'new',
  source      text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on crm_leads (business_id, status);

create table crm_customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  lead_id     uuid references crm_leads(id) on delete set null,
  name        text not null,
  phone       text,
  email       text,
  total_value numeric default 0,
  created_at  timestamptz not null default now()
);

create table crm_deals (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references crm_customers(id) on delete set null,
  lead_id     uuid references crm_leads(id) on delete set null,
  title       text not null,
  value       numeric default 0,
  stage       deal_stage not null default 'lead',
  sort_order  int not null default 0,
  expected_close date,
  created_at  timestamptz not null default now()
);
create index on crm_deals (business_id, stage);

create table crm_tasks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title       text not null,
  description text,
  status      task_status not null default 'todo',
  due_date    date,
  related_to  jsonb,  -- {type:'lead'|'deal', id}
  created_at  timestamptz not null default now()
);

-- AI CEO CHAT (F6)
create table chat_threads (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now()
);
create table chat_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references chat_threads(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role        text not null,  -- user|assistant|system
  content     text not null,
  metadata    jsonb,          -- tokens, sources
  created_at  timestamptz not null default now()
);

-- RAG EMBEDDINGS (F6)
create extension if not exists vector;
create table business_embeddings (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  source      text not null,  -- 'plan'|'research'|'branding'|'crm'
  content     text not null,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index on business_embeddings using ivfflat (embedding vector_cosine_ops);

-- INFRA TABLES
create table agent_logs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  agent       text not null,
  provider    text,
  model       text,
  tokens_in   int,
  tokens_out  int,
  cost_usd    numeric,
  latency_ms  int,
  status      text,
  created_at  timestamptz not null default now()
);

create table jobs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  type        job_type not null,
  status      job_status not null default 'queued',
  payload     jsonb,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id   text,
  stripe_subscription_id text,
  plan                 plan_tier not null default 'free',
  status               text,  -- active|trialing|past_due|canceled
  current_period_end   timestamptz,
  created_at           timestamptz not null default now()
);

create table usage_counters (
  business_id uuid not null references businesses(id) on delete cascade,
  period      text not null,  -- 'YYYY-MM'
  ai_generations int not null default 0,
  ai_chat_msgs   int not null default 0,
  primary key (business_id, period)
);
```

> כל ה-`jsonb` יקבל **Zod schema** מקביל ב-TypeScript כך שגם ה-AI output וגם הקריאה מה-DB מאומתים.

---

## 4. הרשאות ואבטחה (Permissions & RLS)

### 4.1 מודל הרשאות

ב-Phase 1: מודל **single-owner** — לכל עסק יש בעלים אחד (`owner_id`). תשתית ל-team כבר קיימת (מסך settings/team) אך הרשאות צוות מלאות נדחות ל-Phase מאוחר. כל גישה לנתונים עוברת דרך RLS.

| תפקיד | הרשאות |
|-------|--------|
| Owner | CRUD מלא על העסק שלו וכל הישויות התלויות בו |
| Anonymous | קריאה בלבד לאתר שפורסם (`websites.published = true`) |
| Service role | משמש רק ב-server (webhooks, jobs) — לעולם לא נחשף ל-client |

### 4.2 עקרונות RLS

1. **Default deny** — RLS פעיל על כל הטבלאות, ללא policy = אין גישה.
2. כל policy בודק בעלות דרך שרשור ל-`businesses.owner_id = auth.uid()`.
3. ה-`anon` key לעולם לא מאפשר כתיבה לטבלאות פנימיות.

```sql
-- דוגמה: businesses
alter table businesses enable row level security;
create policy "owner_all" on businesses
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- דוגמה: טבלה תלויה (crm_leads)
alter table crm_leads enable row level security;
create policy "owner_via_business" on crm_leads
  for all using (
    exists (select 1 from businesses b
            where b.id = crm_leads.business_id
              and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from businesses b
            where b.id = crm_leads.business_id
              and b.owner_id = auth.uid())
  );

-- דוגמה: אתר ציבורי (קריאה אנונימית)
create policy "public_read_published" on website_pages
  for select using (
    exists (select 1 from websites w
            where w.id = website_pages.website_id
              and w.published = true)
  );
```

### 4.3 שכבת אבטחה (Security Layer)

| שכבה | אמצעי |
|------|-------|
| Transport | HTTPS בלבד (Vercel/Supabase enforced) |
| Auth | Supabase Auth (JWT), email+password + OAuth (Google) |
| Session | httpOnly cookies, refresh דרך middleware |
| Authorization | RLS ב-DB + guard בשכבת service |
| Input validation | Zod על כל input (forms, API, AI output) |
| Rate limiting | Upstash Redis — per-user + per-IP, מחמיר על endpoints של AI |
| Secrets | Environment variables בלבד; service_role רק ב-server |
| AI safety | sanitization של prompt, הגבלת output schema, מניעת prompt-injection מתוכן משתמש |
| Webhooks | אימות חתימה (Stripe signature) |
| PII | הצפנה at-rest (Supabase), מינימיזציה של נתונים בלוגים |
| Audit | `agent_logs` לכל קריאת AI; logging מובנה |
| Errors | Sentry, ללא חשיפת stack traces ל-client |

---

## 5. מסכי מערכת (Screens) וזרימות משתמש (User Flows)

### 5.1 מפת מסכים

```
ציבורי:
  / (Landing) · /pricing · /login · /signup · /reset-password
  /s/[slug] (אתר עסק שפורסם)

מחובר (Dashboard):
  /businesses                       רשימת עסקים + כפתור "עסק חדש"
  /businesses/new                   ★ F1 Wizard (multi-step)
  /businesses/[id]/overview         דשבורד עסק — סטטוס כל הרכיבים
  /businesses/[id]/plan             ★ F1 תוכנית עסקית
  /businesses/[id]/research         ★ F2 מחקר שוק + SWOT
  /businesses/[id]/branding         ★ F3 מיתוג + Brand Book
  /businesses/[id]/website          ★ F4 עורך אתר + preview
  /businesses/[id]/crm/leads        ★ F5 טבלת לידים
  /businesses/[id]/crm/customers    ★ F5 לקוחות
  /businesses/[id]/crm/deals        ★ F5 Kanban pipeline
  /businesses/[id]/crm/tasks        ★ F5 משימות
  /businesses/[id]/ceo-chat         ★ F6 צ'אט AI CEO
  /settings/profile · /settings/billing · /settings/team
```

### 5.2 זרימת משתמש ראשית (Golden Path)

```
Signup → Onboarding קצר → "צור עסק חדש"
   │
   ▼
F1 Wizard (4 שלבים):
   שלב 1: רעיון בסיסי (description, type, industry)
   שלב 2: שוק (location, target_audience)
   שלב 3: כספים (budget, revenue_goal)
   שלב 4: סקירה ואישור
   │
   ▼ [Submit] → יצירת business (status=generating)
   │           → Job: business_plan מתחיל
   ▼
מסך Overview — מציג התקדמות בזמן אמת (Realtime):
   ✓ תוכנית עסקית   (מוכן)
   ⟳ מחקר שוק       (מתבצע...)
   ○ מיתוג          (ממתין)
   ○ אתר            (ממתין)
   │
   ▼ (המשתמש יכול להתחיל לגלוש מיד בכל רכיב שמוכן)
   │
   ▼
שימוש שוטף:
   - עריכת תוכנית/מיתוג/אתר
   - ניהול CRM (הוספת לידים, גרירה ב-pipeline)
   - שיחה עם AI CEO ("מה כדאי לי לעשות השבוע?")
```

### 5.3 זרימות משנה מרכזיות

- **יצירה אסינכרונית:** Submit → `jobs` row → Edge Function/worker מריץ סוכן → כותב תוצאה → Realtime מעדכן UI. אם נכשל → status=failed + כפתור "נסה שוב".
- **עריכה:** כל פלט AI ניתן לעריכה ידנית (תוכנית, מיתוג, תוכן אתר). שמירה אופטימית עם React Query.
- **CRM Pipeline:** Drag-and-drop בין שלבי deal → עדכון `stage` + `sort_order`.
- **AI CEO Chat:** שאלה → retrieval מ-`business_embeddings` → בניית context → streaming תשובה → שמירה ב-`chat_messages`.
- **Quota:** לפני כל פעולת AI → בדיקת `usage_counters` מול ה-plan; חריגה → הודעת שדרוג.

---

## 6. ארכיטקטורת סוכנים (Agent Architecture)

### 6.1 עקרון

כל סוכן הוא מודול עם **חוזה אחיד**:

```ts
interface Agent<TInput, TOutput> {
  name: string;
  systemPrompt: (ctx: BusinessContext) => string;
  outputSchema: ZodSchema<TOutput>;   // אכיפת מבנה JSON
  provider: 'openai' | 'anthropic';   // ניתן להחלפה לפי משימה
  run(input: TInput, ctx: BusinessContext): Promise<TOutput>;
}
```

### 6.2 סוכני Phase 1

| Agent | אחריות | Provider מועדף | Output |
|-------|--------|----------------|--------|
| **CEO Agent** | אורקסטרציה + צ'אט עם RAG | Claude (reasoning) | טקסט/streaming |
| **Business Plan Agent** | F1 — תוכנית עסקית | GPT/Claude | JSON מובנה |
| **Research Agent** | F2 — מתחרים, SWOT | Claude | JSON מובנה |
| **Branding Agent** | F3 — מיתוג מלא | Claude | JSON מובנה |
| **Website Agent** | F4 — תוכן עמודים + SEO | GPT/Claude | JSON (blocks) |

> סוכני Marketing, Content, Sales, Finance, Analytics, Automation, HR — **מוגדרים בארכיטקטורה אך לא ממומשים** ב-Phase 1. ה-CEO Agent בנוי לתזמר אותם בעתיד.

### 6.3 זרימת אורקסטרציה

```
Request → Orchestrator
            │
            ├─ בחירת agent לפי job.type / כוונת המשתמש
            ├─ בניית BusinessContext (שליפה מ-DB)
            ├─ provider abstraction → קריאת LLM (retry + timeout)
            ├─ ולידציית output מול Zod schema
            ├─ רישום ב-agent_logs (טוקנים, עלות, latency)
            └─ החזרת תוצאה / כתיבה ל-DB
```

### 6.4 Provider Abstraction

```ts
interface LLMProvider {
  generateObject<T>(opts: {schema, prompt, system}): Promise<T>;
  streamText(opts: {messages, system}): AsyncIterable<string>;
  embed(text: string): Promise<number[]>;
}
// openaiProvider, anthropicProvider — ניתנים להחלפה דרך config
```

יתרון: עמידות לתקלות ספק (fallback), אופטימיזציית עלות (משימה זולה→GPT-mini, reasoning→Claude).

---

## 7. מבנה API (API Structure)

### 7.1 עקרונות

- **Server Actions** למוטציות מתוך ה-UI (type-safe, ללא endpoint ידני).
- **Route Handlers** ל: streaming chat, webhooks, polling של jobs.
- כל endpoint: auth guard → rate limit → Zod validation → service → תגובה אחידה.
- פורמט תגובה אחיד: `{ data, error }`.

### 7.2 טבלת endpoints עיקריים

| שיטה | נתיב / Action | תיאור | סוג |
|------|---------------|-------|-----|
| Action | `createBusiness(input)` | F1 — יצירת עסק + תור job | mutation |
| GET | `/api/jobs/[id]` | polling סטטוס job | query |
| Action | `updateBusinessPlan(id, data)` | עריכת תוכנית | mutation |
| Action | `regenerateResearch(businessId)` | הרצה מחדש F2 | mutation |
| Action | `updateBranding(id, data)` | עריכת מיתוג | mutation |
| Action | `updateWebsitePage(id, content)` | עריכת עמוד | mutation |
| Action | `publishWebsite(id)` | פרסום אתר | mutation |
| Action | `createLead / updateLead / deleteLead` | CRM leads | mutation |
| Action | `moveDeal(id, stage, order)` | גרירה ב-pipeline | mutation |
| Action | `createTask / toggleTask` | משימות | mutation |
| POST | `/api/ai/chat` | F6 — streaming chat | stream |
| POST | `/api/webhooks/stripe` | אירועי billing | webhook |
| Action | `createCheckoutSession(plan)` | התחלת תשלום | mutation |

---

## 8. לוגיקת מנויים SaaS (Subscription Logic)

### 8.1 מדרגות (Plans)

| Plan | מחיר/חודש | עסקים | AI generations/חודש | הודעות צ'אט | אתר מפורסם |
|------|-----------|-------|---------------------|-------------|------------|
| **Free** | $0 | 1 | 5 | 30 | ✗ |
| **Starter** | $29 | 3 | 50 | 300 | ✓ |
| **Pro** | $79 | 10 | 200 | 1,500 | ✓ |
| **Business** | $199 | ∞ | ∞ | ∞ | ✓ + domain |

> מחירים לדוגמה — ניתנים לכוונון. נאכפים דרך `usage_counters` + בדיקה לפני פעולת AI.

### 8.2 זרימת Billing

```
בחירת plan → createCheckoutSession → Stripe Checkout
   → תשלום → Stripe Webhook (checkout.session.completed)
   → עדכון subscriptions + profiles.plan
   → שחרור quota

ניהול: Stripe Customer Portal (שדרוג/ביטול/חיוב)
אירועי webhook מטופלים: created, updated, deleted, payment_failed
```

### 8.3 אכיפת מגבלות

- Middleware/service בודק `plan` + `usage_counters` לפני פעולת AI.
- חריגה → שגיאה ידידותית + CTA לשדרוג.
- איפוס מונים חודשי (Vercel Cron).

---

## 9. תורי עבודה אסינכרוניים (Async Jobs)

משימות AI כבדות (תוכנית, מחקר, מיתוג, אתר) רצות אסינכרונית:

```
createBusiness → INSERT jobs(type='business_plan', status='queued')
   → trigger worker (Edge Function / Vercel function)
   → status='running' → agent.run() → כתיבת תוצאה
   → status='succeeded' → Realtime → UI מתעדכן
   (כשל → status='failed' + error → כפתור retry)
```

יתרונות: אין timeout של HTTP, UX מיידי (overview עם progress), אפשרות retry, מדרגיות.

---

## 10. תוכנית בדיקות ואיכות (Quality)

| סוג | כלי | כיסוי |
|-----|-----|-------|
| Unit | Vitest | services, validation, agent schemas |
| Integration | Vitest + Supabase test DB | RLS policies, services |
| E2E | Playwright | golden path: signup→wizard→overview→CRM→chat |
| Type safety | TypeScript strict + DB-generated types | מקצה לקצה |
| Lint/format | ESLint + Prettier | CI gate |
| AI output | Zod validation בכל קריאה | אכיפת מבנה |

**Definition of Done לכל פיצ'ר:** DB+RLS ✓ · service+ולידציה ✓ · UI מלא (loading/empty/error) ✓ · אינטגרציית AI ✓ · בדיקות ✓ · רספונסיבי ✓.

---

## 11. Roadmap פיתוח (Phase 1)

בנייה ב-**vertical slices** — כל אבן דרך מסתיימת בפיצ'ר עובד מקצה לקצה.

| Milestone | תוכן | תוצר |
|-----------|------|------|
| **M0 — Foundation** | scaffold, Supabase, Auth, layout, ShadCN, env, CI, migrations בסיס, RLS framework | אפליקציה רצה, התחברות עובדת |
| **M1 — F1 Wizard + Plan** | סכמת businesses+profiles, wizard UI, job queue, Business Plan Agent, overview, עריכה | רעיון → תוכנית עסקית מלאה |
| **M2 — F2 Research** | market_research, Research Agent, מסך SWOT+מתחרים, regenerate | מחקר שוק עובד |
| **M3 — F3 Branding** | brand_assets, Branding Agent, מסך מיתוג, color/typography, logo prompt+storage | מיתוג עובד |
| **M4 — F4 Website** | websites+pages, Website Agent, עורך blocks, preview, פרסום ב-/s/[slug], SEO | אתר חי וניתן לעריכה |
| **M5 — F5 CRM** | leads/customers/deals/tasks, טבלאות, Kanban drag-drop, conversions | CRM מלא |
| **M6 — F6 AI CEO** | embeddings (RAG), CEO Agent, chat streaming, threads, context | צ'אט CEO עובד |
| **M7 — Billing + Hardening** | Stripe, plans, quota, rate-limit, Sentry, e2e מלא, אופטימיזציה | מוכן ל-production |

> רק לאחר ש-**כל** ה-Milestones (M0–M7) עובדים מקצה לקצה ללא תקלות — נתחיל בתכנון Phase 2.

---

## 12. סיכונים והפחתתם (Risks)

| סיכון | השפעה | הפחתה |
|-------|-------|-------|
| עלויות AI גבוהות | תקציב | quota, caching, מודלים זולים למשימות פשוטות, agent_logs למעקב |
| latency של יצירה | UX | async jobs + progress UI |
| איכות פלט AI לא עקבית | אמון | output schemas, prompts מהונדסים, אפשרות regenerate+עריכה |
| prompt injection מתוכן משתמש | אבטחה | sanitization, הפרדת system/user, output מוגבל |
| נעילת ספק | עסקי | provider abstraction |
| מדרגיות DB | ביצועים | אינדקסים, RLS יעיל, pagination |

---

## 13. דרישות לתחילת פיתוח (Prerequisites)

לפני M0 אצטרך ממך:

1. **Supabase project** — URL + anon key + service_role key
2. **OpenAI API key** ו/או **Anthropic API key**
3. **Stripe** (אפשר בשלב M7) — keys + webhook secret
4. **Upstash Redis** (rate-limit) — אפשר בשלב מאוחר
5. אישור על **שם החבילה / domain** (לא חובה ל-MVP)

עד שאלה מוכנים, אפשר להתחיל M0–M6 עם **מצב dev** (מפתחות בקובץ `.env.local`).

---

## 13.5 החלטות מוצר שאושרו (Confirmed Product Decisions)

| נושא | החלטה | השלכה טכנית |
|------|-------|-------------|
| **שפת ממשק** | עברית + RTL מהיסוד | `<html dir="rtl" lang="he">`, Tailwind logical properties (ms/me/ps/pe), פונט Heebo/Assistant, רכיבי ShadCN מותאמי RTL, בדיקות e2e ב-RTL |
| **ספקי AI** | שניהם — Provider Abstraction | Claude ל-reasoning (תוכנית/מחקר/מיתוג/CEO chat), OpenAI ל-embeddings ומשימות זולות; fallback בין ספקים; שני מפתחות ב-env |
| **שפת פלט AI** | עברית כברירת מחדל | כל ה-prompts מנחים פלט בעברית; schemas תומכים בטקסט עברי; אתרים נוצרים בעברית RTL |

> **הערה:** התוכן שה-AI מייצר (תוכנית עסקית, מיתוג, אתר) יהיה **בעברית**, והאתרים הנוצרים יהיו RTL.

---

## 13.6 סטיות מימוש מהתכנון (Implementation Deviations)

עדכונים שנקבעו בזמן הבנייה בפועל (M0), מתועדים לשקיפות:

| נושא | בתכנון המקורי | בפועל | סיבה |
|------|----------------|-------|------|
| גרסת Next.js | 15 | **16.2.7** | `create-next-app@latest` מספק 16; תואם לאחור, App Router זהה, Turbopack יציב |
| Tailwind | (לא צוין) | **v4** (config ב-CSS) | ברירת המחדל החדשה; RTL דרך logical properties |
| בסיס ShadCN | Radix (מרומז) | **Base UI** (style `base-nova`) | ברירת המחדל החדשה של shadcn; אותו צוות, איכותי. הבדל עיקרי: `render` במקום `asChild`, `onClick` במקום `onSelect` |
| כפתור-קישור | `<Button asChild>` | רכיב **`ButtonLink`** ייעודי | Base UI דורש `<button>` נייטיב; ButtonLink מחיל `buttonVariants` על `<Link>` (סמנטיקה + נגישות נכונות) |
| Middleware | `middleware.ts` | **`proxy.ts`** | Next 16 שינה את הקונבנציה (middleware deprecated) |

---

## 14. אישור (Sign-off)

מסמך זה מהווה את התכנון המחייב ל-Phase 1. **לא ייכתב קוד עד לאישורך.**

נדרש אישור ל:
- [ ] ארכיטקטורה וסטאק (סעיף 1)
- [ ] מבנה תיקיות (סעיף 2)
- [ ] סכמת DB ו-ERD (סעיף 3)
- [ ] הרשאות ואבטחה (סעיף 4)
- [ ] מסכים וזרימות (סעיף 5)
- [ ] ארכיטקטורת סוכנים (סעיף 6)
- [ ] API (סעיף 7)
- [ ] לוגיקת מנויים (סעיף 8)
- [ ] Roadmap (סעיף 11)

**לאחר אישורך — נתחיל ב-M0 (Foundation).**
