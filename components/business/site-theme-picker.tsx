"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setSiteThemeAction, suggestSiteThemeAction } from "@/lib/actions/design";
import { SITE_THEMES, DEFAULT_SITE_THEME, type SiteTheme } from "@/lib/site-theme";

/**
 * A miniature of the real page, built from the scheme's OWN tokens — the same
 * `SITE_THEMES` entry the storefront renders from, so a swatch can never drift
 * from what the site actually does. Shows the four things a scheme changes:
 * the header, the ground, a raised band with a card on it, and the accent
 * (headline gradient + CTA pill), tinted with this business's brand colour.
 */
function Preview({ t, brand }: { t: SiteTheme; brand: string }) {
  const accent = `color-mix(in srgb, ${brand} 55%, ${t.accent})`;
  return (
    <div
      className="relative h-[86px] overflow-hidden rounded-lg"
      style={{ background: t.ground, border: `1px solid ${t.hair}` }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-2 py-1.5"
        style={{ background: t.headerBg, borderBottom: `1px solid ${t.hair}` }}
      >
        <span
          className="h-1.5 w-8 rounded-full"
          style={{ background: accent, opacity: 0.9 }}
        />
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-3 rounded-full"
              style={{ background: t.inkSoft, opacity: 0.55 }}
            />
          ))}
        </span>
      </div>
      {/* headline + body */}
      <div className="px-2 pt-2">
        <div
          className="h-2.5 w-[62%] rounded-sm"
          style={{
            background: `linear-gradient(120deg, ${t.ink} 0%, ${accent} 45%, ${t.heroFade} 100%)`,
          }}
        />
        <div
          className="mt-1 h-1 w-[42%] rounded-full"
          style={{ background: t.inkDim, opacity: 0.75 }}
        />
      </div>
      {/* raised band with a card + a CTA pill */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2 py-1.5"
        style={{ background: t.raised, borderTop: `1px solid ${t.hair}` }}
      >
        <span
          className="h-6 w-9 rounded"
          style={{ background: t.card, border: `1px solid ${t.hair}` }}
        />
        <span
          className="h-6 w-9 rounded"
          style={{ background: t.card, border: `1px solid ${t.hair}` }}
        />
        <span
          className="ms-auto h-4 w-11 rounded-full"
          style={{ background: `linear-gradient(135deg, ${brand}, ${accent} 55%, ${t.accent})` }}
        />
      </div>
    </div>
  );
}

export function SiteThemePicker({
  businessId,
  brandHex,
  current,
}: {
  businessId: string;
  brandHex: string;
  current: string | null | undefined;
}) {
  const router = useRouter();
  const [sel, setSel] = useState(current || DEFAULT_SITE_THEME);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [, startTransition] = useTransition();

  function aiPick() {
    setAiBusy(true);
    startTransition(async () => {
      const res = await suggestSiteThemeAction(businessId);
      if (res.error) toast.error(res.error);
      else if (res.theme) {
        setSel(res.theme);
        toast.success(`ה-AI בחר: ${res.label}${res.reason ? ` — ${res.reason}` : ""}`);
        router.refresh();
      }
      setAiBusy(false);
    });
  }

  function choose(k: string) {
    setSel(k);
    setBusy(k);
    startTransition(async () => {
      const res = await setSiteThemeAction(businessId, k);
      if (res.error) toast.error(res.error);
      else {
        toast.success("ערכת הצבעים של האתר עודכנה ✓");
        router.refresh();
      }
      setBusy(null);
    });
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">ערכת הצבעים של האתר</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={aiPick}
            disabled={aiBusy || busy !== null}
          >
            {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            התאמה אוטומטית ב-AI
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          זה הרקע שכל האתר נצבע עליו — הכותרות, הכרטיסים, הפוטר והכפתורים מתאימים
          את עצמם אליו אוטומטית, וצבע המותג שלכם נשאר המבטא בכל ערכה. אזור הפתיחה
          (ה-Hero) נשאר קולנועי וכהה גם בערכות הבהירות.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SITE_THEMES.map((t) => {
            const active = sel === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => choose(t.key)}
                disabled={busy !== null}
                className={`rounded-xl border p-2 text-right transition ${active ? "border-primary ring-1 ring-primary" : "border-input hover:border-muted-foreground/40"}`}
              >
                <Preview t={t} brand={brandHex} />
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="text-xs font-medium">{t.label}</span>
                  {busy === t.key ? (
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  ) : active ? (
                    <Check className="size-3.5 text-primary" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
