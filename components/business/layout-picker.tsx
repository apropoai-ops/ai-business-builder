"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { setLayoutStyleAction } from "@/lib/actions/layout";
import { SITE_LAYOUT_LIST, type SiteLayoutKey } from "@/lib/site-layout";

/** Mini wireframe preview of a layout's section order, tinted with the brand color. */
function Preview({ layoutKey, brand }: { layoutKey: SiteLayoutKey; brand: string }) {
  const block = (w: string, h: number, tone: "strong" | "soft" = "soft", key?: string) => (
    <div
      key={key}
      style={{
        width: w,
        height: h,
        borderRadius: 3,
        background: tone === "strong" ? brand : `${brand}33`,
      }}
    />
  );

  const rows: React.ReactNode[] =
    layoutKey === "showcase"
      ? [
          <div key="hero" className="flex gap-1">{block("100%", 12, "strong")}</div>,
          <div key="grid" className="grid grid-cols-3 gap-1">{[0, 1, 2].map((i) => block("100%", 14, "soft", `g${i}`))}</div>,
          block("70%", 6, "soft", "r1"),
          block("90%", 6, "soft", "r2"),
        ]
      : layoutKey === "story"
        ? [
            <div key="hero" className="flex gap-1">{block("100%", 12, "strong")}</div>,
            <div key="split" className="flex gap-1">{block("42%", 22, "soft")}{block("55%", 22, "soft")}</div>,
            block("90%", 6, "soft", "r1"),
            block("60%", 6, "soft", "r2"),
          ]
        : layoutKey === "compact"
          ? [
              <div key="hero" className="flex gap-1">{block("100%", 12, "strong")}</div>,
              <div key="center" className="flex justify-center">{block("70%", 10, "strong")}</div>,
              <div key="center2" className="flex justify-center">{block("60%", 8, "soft")}</div>,
            ]
          : layoutKey === "express"
            ? [
                <div
                  key="calendar"
                  style={{ width: "100%", height: 26, borderRadius: 4, background: `${brand}33` }}
                  className="grid grid-cols-6 gap-0.5 p-1"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <div key={`d${i}`} style={{ borderRadius: 1, background: brand }} />
                  ))}
                </div>,
                block("90%", 6, "soft", "r1"),
                block("70%", 6, "soft", "r2"),
              ]
            : [
                // flow — classic top-to-bottom stack
                <div key="hero" className="flex gap-1">{block("100%", 12, "strong")}</div>,
                block("90%", 6, "soft", "r1"),
                block("100%", 10, "soft", "r2"),
                block("80%", 6, "soft", "r3"),
              ];

  return (
    <div
      style={{ height: 74, borderRadius: 10, background: "#f2f2ee", padding: 8 }}
      className="flex flex-col justify-start gap-1.5 overflow-hidden"
    >
      {rows}
    </div>
  );
}

export function LayoutPicker({
  businessId,
  brandHex,
  current,
}: {
  businessId: string;
  brandHex: string;
  current: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string>(current || "flow");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function choose(k: SiteLayoutKey) {
    if (k === sel) return;
    setSel(k);
    setBusy(k);
    startTransition(async () => {
      const res = await setLayoutStyleAction(businessId, k);
      if (res.error) toast.error(res.error);
      else {
        toast.success("מבנה האתר עודכן ✓");
        router.refresh();
      }
      setBusy(null);
    });
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">מבנה האתר</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          בחרו את סדר האזורים באתר החנות שלכם — אזור הפתיחה (Hero) נשאר כפי שהוגדר בנפרד.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SITE_LAYOUT_LIST.map((layout) => {
            const active = sel === layout.key;
            return (
              <button
                key={layout.key}
                type="button"
                onClick={() => choose(layout.key)}
                disabled={busy !== null}
                className={`rounded-xl border p-2 text-right transition ${active ? "border-primary ring-1 ring-primary" : "border-input hover:border-muted-foreground/40"}`}
              >
                <Preview layoutKey={layout.key} brand={brandHex} />
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="text-xs font-medium">{layout.label}</span>
                  {busy === layout.key ? (
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  ) : active ? (
                    <Check className="size-3.5 text-primary" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {layout.description}
                </p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
