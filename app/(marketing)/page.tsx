import {
  Sparkles,
  FileText,
  Search,
  Palette,
  Globe,
  Users,
  MessageSquare,
  PenLine,
  CalendarDays,
  Share2,
  MessageCircle,
  ArrowLeft,
  ChevronDown,
  Star,
  ShoppingBag,
  CreditCard,
  CalendarClock,
  ReceiptText,
  Clock,
  ShieldCheck,
  Zap,
} from "lucide-react";

import Link from "next/link";

import { ButtonLink } from "@/components/ui/button-link";
import { getUser } from "@/lib/auth/user";
import { PLANS, PACKAGE_ORDER } from "@/lib/plans";

const features = [
  {
    icon: FileText,
    title: "תוכנית עסקית",
    desc: "תקציר מנהלים, מודל עסקי, תמחור ותוכנית השקה — נוצרים אוטומטית.",
  },
  {
    icon: Search,
    title: "מחקר שוק",
    desc: "ניתוח מתחרים, SWOT, הזדמנויות ומיצוב מומלץ.",
  },
  {
    icon: Palette,
    title: "מיתוג מלא",
    desc: "שם, סלוגן, פלטת צבעים, טיפוגרפיה ו-Brand Book.",
  },
  {
    icon: Globe,
    title: "אתר אינטרנט",
    desc: "אתר רספונסיבי, מותאם SEO וניתן לעריכה — מוכן לפרסום.",
  },
  {
    icon: Users,
    title: "מערכת CRM",
    desc: "לידים, לקוחות, משימות וצנרת עסקאות במקום אחד.",
  },
  {
    icon: MessageSquare,
    title: "AI CEO",
    desc: "יועץ חכם שמכיר את העסק שלכם ועונה על כל שאלה.",
  },
  {
    icon: PenLine,
    title: "מנוע תוכן",
    desc: "פוסטים, ריילס, בלוגים ואימיילים — מותאמים לכל פלטפורמה.",
  },
  {
    icon: CalendarDays,
    title: "לוח תוכן",
    desc: "תוכנית פרסום מתוזמנת לשבוע, חודש או רבעון.",
  },
  {
    icon: Share2,
    title: "רשתות חברתיות",
    desc: "אסטרטגיה לאינסטגרם, פייסבוק, לינקדאין וטיקטוק.",
  },
  {
    icon: MessageCircle,
    title: "סוכן וואטסאפ",
    desc: "סוכן AI שמטפל בלידים, הזמנות, שאלות נפוצות ומכירות.",
  },
  {
    icon: ShoppingBag,
    title: "חנות אונליין",
    desc: "חנות מלאה — מוצרים, סל קניות, וריאציות, קופונים ומשלוחים.",
  },
  {
    icon: CreditCard,
    title: "סליקת אשראי באתר",
    desc: "הלקוחות משלמים בכרטיס ישירות באתר, וההזמנה נסגרת אוטומטית.",
  },
  {
    icon: CalendarClock,
    title: "תורים והזמנות",
    desc: "קביעת תורים, יומן זמינות ושריון תאריכים לאירוח — אונליין.",
  },
  {
    icon: ReceiptText,
    title: "הצעות מחיר",
    desc: "הצעות מחיר מעוצבות שהלקוח מאשר בלחיצה, עם מע״מ אוטומטי.",
  },
];

const steps = [
  {
    title: "מתארים את הרעיון",
    desc: "כמה משפטים על מה שאתם רוצים להקים — תחום, קהל יעד וסגנון. זה הכול.",
  },
  {
    title: "ה-AI בונה הכל",
    desc: "תוכנית עסקית, מחקר שוק, מיתוג, אתר, CRM ותוכן שיווקי — נוצרים אוטומטית עבורכם.",
  },
  {
    title: "מנהלים ומוכרים",
    desc: "מפרסמים את האתר, מקבלים לידים והזמנות, וסוכני ה-AI עובדים בשבילכם 24/7.",
  },
];

const planHooks: Record<string, string> = {
  free: "בונים ובודקים את הרעיון — בלי כרטיס אשראי",
  starter: "דף נחיתה אחד שממיר — לקמפיינים ולהשקות",
  pro: "אתר תדמית מלא עם תורים, תוכן ולידים",
  business: "חנות מלאה עם סליקה, וכל כלי ה-AI המתקדמים",
};

const faqs = [
  {
    q: "כמה זמן לוקח להקים עסק?",
    a: "דקות ספורות. מתארים את הרעיון בכמה משפטים, וה-AI יוצר תוכנית עסקית, מחקר שוק, מיתוג ואתר מוכן. אחר כך אפשר לערוך, לדייק ולפרסם בקצב שלכם.",
  },
  {
    q: "האם אפשר לערוך את מה שה-AI יוצר?",
    a: "בהחלט. כל תוצר — תוכנית עסקית, מיתוג, אתר ותוכן שיווקי — ניתן לעריכה מלאה. ה-AI נותן נקודת פתיחה חזקה, ואתם מחליטים מה נשאר.",
  },
  {
    q: "האם האתר באמת עולה לאוויר?",
    a: "כן. בכל חבילה בתשלום האתר מתפרסם לאוויר — רספונסיבי, מותאם SEO ולוכד לידים ישירות ל-CRM שלכם. החבילה קובעת מה בונים: דף נחיתה, אתר תדמית עם יומן תורים, או חנות מלאה עם סליקת אשראי.",
  },
  {
    q: "מה קורה כשנגמרת המכסה?",
    a: "שום דבר לא נמחק — האתר, ה-CRM וכל התוצרים ממשיכים לעבוד. המכסות החודשיות (יצירות AI והודעות צ'אט) מתחדשות בכל חודש, ואפשר לשדרג תוכנית בכל רגע כדי להמשיך ליצור.",
  },
  {
    q: "אפשר לבטל מתי שרוצים?",
    a: "כן. אין התחייבות — מבטלים בכל עת מהאזור האישי, עוברים לתוכנית החינמית, והנתונים שלכם נשמרים.",
  },
];

export default async function LandingPage() {
  const user = await getUser();

  return (
    <main className="flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </div>
            {/* Hidden on phones: with three buttons it overflowed 375px. */}
            <span className="hidden sm:inline">AI Business Builder</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <ButtonLink href="/pricing" variant="ghost">
              חבילות
            </ButtonLink>
            {user ? (
              <ButtonLink href="/businesses">לאזור האישי</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost">
                  התחברות
                </ButtonLink>
                <ButtonLink href="/signup">התחילו בחינם</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" />
          ה-AI שבונה ומנהל לכם את העסק
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          מרעיון לעסק פעיל —{" "}
          <span className="text-primary">תוך דקות</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          תארו את הרעיון שלכם, וקבלו תוכנית עסקית, מחקר שוק, מיתוג, אתר,
          מערכת CRM, מנוע תוכן וסוכני AI לשיווק — הכול אוטומטי, במקום אחד.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink size="lg" href={user ? "/businesses" : "/signup"}>
            בנו את העסק שלכם
            <ArrowLeft className="size-4" />
          </ButtonLink>
          <ButtonLink size="lg" variant="outline" href="/s/golden-memory-demo">
            צפו באתר לדוגמה
          </ButtonLink>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          חינם להתחלה · ללא כרטיס אשראי · בעברית מלאה
        </p>
      </section>

      {/* Trust bar */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Clock, stat: "דקות", label: "מרעיון לאתר חי" },
            { icon: Zap, stat: "14+", label: "כלי AI מובנים" },
            { icon: Sparkles, stat: "20+", label: "מודולים מוכנים לאתר" },
            { icon: ShieldCheck, stat: "0", label: "ידע טכני נדרש" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1 text-center">
              <item.icon className="size-6 text-primary" />
              <span className="text-2xl font-bold">{item.stat}</span>
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <h2 className="text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
            איך זה עובד?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-muted-foreground">
            שלושה שלבים פשוטים — מרעיון ראשוני לעסק שעובד.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live demo */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <div className="rounded-3xl border bg-card p-8 text-center sm:p-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Globe className="size-4 text-primary" />
            אתר אמיתי שנבנה בפלטפורמה
          </div>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            ככה נראה עסק חי אצלנו
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
            חנות התכשיטים GOLDEN MEMORY נבנתה מקצה לקצה בפלטפורמה — אתר,
            קטלוג תכשיטים בחריטה אישית, מיתוג, תוכן ו-SEO. זו תצוגה בלבד, אז
            אפשר להסתובב בה בחופשיות בלי לבצע הזמנה.
          </p>
          <div className="mt-8">
            <ButtonLink size="lg" href="/s/golden-memory-demo">
              לצפייה באתר הדוגמה
              <ArrowLeft className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <h2 className="text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
          החבילות שלנו
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-muted-foreground">
          בחרו את החבילה שמתאימה לכם — אפשר לשדרג בכל שלב.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PACKAGE_ORDER.map((tier) => {
            const plan = PLANS[tier];
            return (
              <div
                key={plan.tier}
                className={`relative rounded-xl border bg-card p-6 transition-shadow hover:shadow-md ${
                  plan.highlight ? "border-primary shadow-sm" : ""
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 start-4 flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    <Star className="size-3 fill-current" />
                    מומלץ
                  </span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    ₪{plan.priceMonthly}
                  </span>
                  <span className="text-sm text-muted-foreground">לחודש</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {planHooks[plan.tier]}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/pricing" variant="outline" size="lg">
            לכל החבילות
            <ArrowLeft className="size-4" />
          </ButtonLink>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-24">
          <h2 className="text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
            שאלות נפוצות
          </h2>
          <div className="mt-12 flex flex-col gap-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border bg-card p-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
          העסק הבא שלכם מחכה.{" "}
          <span className="text-primary">בואו נבנה אותו.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          מצטרפים בחינם, מתארים את הרעיון — ותוך דקות יש לכם עסק עם תוכנית,
          מיתוג, אתר וכלים לניהול ושיווק.
        </p>
        <div className="mt-10 flex items-center justify-center">
          <ButtonLink size="lg" href={user ? "/businesses" : "/signup"}>
            התחילו בחינם עכשיו
            <ArrowLeft className="size-4" />
          </ButtonLink>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center text-sm text-muted-foreground">
          <nav className="flex items-center gap-6">
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              חבילות
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              התחברות
            </Link>
            <Link href="/signup" className="transition-colors hover:text-foreground">
              הרשמה
            </Link>
          </nav>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            <Link href="/terms" className="transition-colors hover:text-foreground">
              תקנון ותנאי שימוש
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              מדיניות פרטיות
            </Link>
            <Link href="/refund" className="transition-colors hover:text-foreground">
              ביטולים והחזרות
            </Link>
            <Link href="/accessibility" className="transition-colors hover:text-foreground">
              הצהרת נגישות
            </Link>
          </nav>
          <div>
            © {new Date().getFullYear()} AI Business Builder · נבנה בעברית 🇮🇱
          </div>
        </div>
      </footer>
    </main>
  );
}
