# AI Business Builder

פלטפורמת SaaS בעברית שהופכת רעיון עסקי לעסק פעיל: תוכנית עסקית, מחקר שוק,
מיתוג, אתר חי, CRM, חנות עם סליקה, תורים, תוכן שיווקי וסוכני AI — במקום אחד.

**באוויר:** https://apropo.business

| מה | קישור |
|----|-------|
| דף הבית + חבילות | https://apropo.business · https://apropo.business/pricing |
| אתר לקוח לדוגמה — חנות (קטלוג בלבד, אי אפשר להזמין) | https://apropo.business/s/golden-memory-demo |
| אתר לקוח לדוגמה — אתר תדמית | https://apropo.business/s/chabad-bangkok |
| הרשמה ולוח הבקרה | https://apropo.business/signup |

## איך זה עובד

1. הלקוח בוחר חבילה — **דף נחיתה / אתר תדמית / חנות**. החבילה היא גם מצב האתר.
2. אשף קצר אוסף תיאור של העסק, וסוכני AI מייצרים תוכנית עסקית, מחקר שוק,
   מיתוג (לוגו, צבעים, טיפוגרפיה) ואתר מלא.
3. מלוח הבקרה מנהלים את העסק: לידים ולקוחות, הזמנות והחזרות, תורים ואירוח,
   הצעות מחיר, תוכן ורשתות, וואטסאפ, אוטומציות ודוחות.
4. האתר הציבורי מוגש תחת `/s/<slug>` (או דומיין של הלקוח), עם 8 סגנונות Hero,
   ערכות צבע וחנות עם סל, קופונים, וריאציות וסליקה.

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript · TailwindCSS v4 · ShadCN/UI (Base UI) · RTL מלא
- **Supabase** — Postgres עם RLS על כל טבלה, Auth, Storage, pgvector · 100 מיגרציות
- **AI** — Vercel AI SDK. טקסט רץ על **Gemini** (שכבה חינמית) עם Claude כגיבוי;
  תמונות: Gemini → Pollinations (חינם, בלי מפתח) → OpenAI
- **תשלומים** — Stripe למנויי הפלטפורמה; סליקה לכל עסק בנפרד (פרטי הספק מוצפנים)
- **עוד** — Resend (מייל), WhatsApp Cloud API, Cloudflare Turnstile, Web Push, Vercel Cron
- **בדיקות** — Vitest (37 קבצים, ~580 בדיקות)

## מבנה

```
app/(marketing)/          דף בית, חבילות, מסמכים משפטיים
app/(auth)/               הרשמה, התחברות, שחזור סיסמה
app/(dashboard)/          לוח הבקרה — מודול לכל תחום (crm, store, bookings, website…)
app/s/[slug]/             אתרי הלקוחות הציבוריים
app/api/                  webhooks (Stripe, WhatsApp, סליקה), cron, jobs
components/public/        רכיבי האתר הציבורי (heroes, tiers, חנות)
lib/ai · lib/jobs         סוכני ה-AI ותור העבודות האסינכרוני
lib/services · lib/actions  לוגיקה עסקית ו-Server Actions
supabase/migrations/      סכמת מסד הנתונים
tests/                    בדיקות Vitest
docs/                     מסמכי תכנון, הקמה ומשפט
```

## הרצה מקומית

```bash
npm install
cp .env.example .env.local   # מלאו את המפתחות
npm run dev                  # http://localhost:3000
```

המינימום: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` ו-`GEMINI_API_KEY`. שאר השירותים (Stripe, Resend,
וואטסאפ ועוד) רדומים עד שמגדירים להם מפתח — ראו [`.env.example`](.env.example).
את המיגרציות שב-[`supabase/migrations`](supabase/migrations) מריצים על פרויקט ה-Supabase לפני שימוש.

| פקודה | תיאור |
|-------|-------|
| `npm run dev` | שרת פיתוח |
| `npm run build` | בילד production |
| `npm run lint` | ESLint |
| `npm run typecheck` | בדיקת טיפוסים |
| `npm test` | בדיקות Vitest |

## פריסה

הפרויקט רץ על Vercel:

```bash
npx vercel --prod --scope apropo-s-projects --yes
```
