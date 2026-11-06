import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck, Store } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DemoPayForm } from "./demo-pay-form";

/**
 * Self-hosted fake hosted-payment-page for the "demo" gateway
 * (lib/gateways/providers/demo.ts). Public route — never gated behind auth
 * (see the `pay/` exclusion in proxy.ts's matcher) since real shoppers land
 * here mid-checkout. Everything here is cosmetic: the card fields are never
 * validated, stored, or transmitted anywhere — only the order id / amount /
 * signature that createCheckout embedded in the URL are ever sent onward,
 * to our own callback route.
 */

export const metadata: Metadata = {
  title: "דף תשלום — סביבת דמו",
  robots: { index: false, follow: false },
};

function ErrorShell({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <ShieldAlert className="size-10 text-zinc-400" />
          <p className="text-lg font-semibold">קישור תשלום לא תקין</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The return/callback URLs arrive in the query string, so anyone can craft a
 * link to this page. They must be same-origin http(s) URLs — otherwise
 * `javascript:` in su/cu would run script on our origin when the shopper
 * clicks a button, and an external su/cu/cb would turn the page into an open
 * redirect. Returns the normalised URL or null.
 */
function sameOriginUrl(raw: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  try {
    const base = new URL(appUrl);
    const u = new URL(raw, base);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.origin !== base.origin) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

export default async function DemoPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{
    amount?: string;
    desc?: string;
    name?: string;
    label?: string;
    cb?: string;
    su?: string;
    cu?: string;
    sig?: string;
  }>;
}) {
  const { orderId } = await params;
  const { amount, desc, name, label, cb, su, cu, sig } = await searchParams;

  if (!amount || !cb || !su || !cu || !sig) {
    return (
      <ErrorShell message="חסרים פרטים בקישור התשלום — יש לפתוח את דף התשלום מחדש מתהליך התשלום בחנות." />
    );
  }

  const callbackUrl = sameOriginUrl(cb);
  const successUrl = sameOriginUrl(su);
  const cancelUrl = sameOriginUrl(cu);
  if (!callbackUrl || !successUrl || !cancelUrl) {
    return (
      <ErrorShell message="קישור התשלום אינו תקין — יש לפתוח את דף התשלום מחדש מתהליך התשלום בחנות." />
    );
  }

  const amountNum = Number(amount);
  const amountText = Number.isFinite(amountNum)
    ? amountNum.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        {/* Prominent demo banner — must never be mistaken for a real charge */}
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">דף תשלום — סביבת דמו</p>
            <p className="mt-0.5">זהו דף תשלום מדומה — לא מתבצע חיוב אמיתי.</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="gap-3 border-b">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Store className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">תשלום עבור</p>
                <p className="truncate text-base font-bold">{label || "החנות שלי"}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 pt-5">
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-4">
              {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
              {name && <p className="text-xs text-muted-foreground">לקוח/ה: {name}</p>}
              <p className="mt-1 text-3xl font-bold" dir="ltr">
                ₪{amountText}
              </p>
            </div>

            <DemoPayForm
              orderId={orderId}
              amount={amount}
              sig={sig}
              callbackUrl={callbackUrl}
              successUrl={successUrl}
              cancelUrl={cancelUrl}
            />

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> מאובטח (הדגמה)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
