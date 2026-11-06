import { Sparkles } from "lucide-react";

import { getUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button-link";
import { PlanCards } from "@/components/billing/plan-cards";
import { AddonBuyButton } from "@/components/billing/addon-buy-button";
import { ADDONS } from "@/lib/plans";
import type { PlanTier } from "@/types/database";

export const metadata = {
  title: "חבילות",
  description: "חבילות גמישות לכל שלב — מהרעיון הראשון ועד עסק שרץ לבד.",
};

export default async function PricingPage() {
  const user = await getUser();

  let currentPlan: PlanTier | null = null;
  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles").select("plan").eq("id", user.id).maybeSingle();
    currentPlan = (profile?.plan as PlanTier) ?? "free";
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <ButtonLink href="/" variant="ghost" className="gap-2 font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            {/* Brand text + both buttons don't fit a 375px phone — the nav
                pushed the page into a sideways scroll. The icon carries it. */}
            <span className="hidden sm:inline">AI Business Builder</span>
          </ButtonLink>
          <nav className="flex items-center gap-1 sm:gap-2">
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

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight">
            החבילות שלנו
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
            החבילה קובעת מה בונים: דף נחיתה לקמפיין, אתר תדמית מלא, או חנות עם
            סליקת אשראי. אפשר לשדרג או לבטל בכל רגע.
          </p>
        </div>

        <PlanCards currentPlan={currentPlan} isLoggedIn={Boolean(user)} />

        <p className="mt-10 text-center text-sm text-muted-foreground">
          המחירים כוללים מע&quot;מ. המכסות מתאפסות בתחילת כל חודש.
        </p>
      </section>

      {/* Paid add-ons — attach to any package */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-16">
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <h2 className="text-center text-2xl font-bold tracking-tight">תוספות בתשלום</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
            מוסיפים לכל חבילה בדיוק את מה שצריך — בלי לשדרג חבילה שלמה.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {ADDONS.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3 rounded-xl border bg-background p-4">
                <div className="min-w-0">
                  <div className="font-semibold">{a.label}</div>
                  <div className="text-sm text-muted-foreground">{a.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="whitespace-nowrap font-bold text-primary">
                    +₪{a.priceMonthly}
                    <span className="text-xs font-normal text-muted-foreground">/חודש</span>
                  </div>
                  <AddonBuyButton addonKey={a.key} isLoggedIn={Boolean(user)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} AI Business Builder · נבנה בעברית 🇮🇱
        </div>
      </footer>
    </main>
  );
}
