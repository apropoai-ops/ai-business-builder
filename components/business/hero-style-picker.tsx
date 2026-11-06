"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setHeroStyleAction, suggestHeroStyleAction } from "@/lib/actions/design";
import { HERO_STYLES as STYLES } from "@/lib/hero-style";

/** Mini preview swatch per style, tinted with the business brand color. */
function Preview({ k, brand }: { k: string; brand: string }) {
  const base: React.CSSProperties = { height: 74, borderRadius: 10, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 10 };
  const bar = (bg: string, txt: string) => (
    <>
      <div style={{ height: 7, width: "55%", borderRadius: 3, background: txt, opacity: 0.9 }} />
      <div style={{ marginTop: 5, height: 5, width: "38%", borderRadius: 3, background: txt, opacity: 0.45 }} />
      <div style={{ marginTop: 7, height: 14, width: 52, borderRadius: 999, background: bg }} />
    </>
  );
  if (k === "orbit")
    return (
      <div style={{ ...base, background: "#070319" }}>
        <div style={{ position: "absolute", left: 14, top: 6, width: 44, height: 44, borderRadius: "50%", border: `1px solid ${brand}77` }} />
        <div style={{ position: "absolute", left: 22, top: 14, width: 28, height: 28, borderRadius: "50%", border: `1px solid ${brand}aa` }} />
        {bar(brand, "#fff")}
      </div>
    );
  if (k === "spotlight")
    return (
      <div style={{ ...base, background: "#0a0a0a" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle 34px at 62% 34%, ${brand}bb, transparent 70%)` }} />
        {bar(brand, "#fff")}
      </div>
    );
  if (k === "vanguard")
    return (
      <div style={{ ...base, background: `linear-gradient(160deg, #0a0a0a, ${brand}55)`, justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(80% 80% at 50% 50%, transparent 30%, rgba(0,0,0,.55))" }} />
        <div style={{ position: "relative", fontFamily: "'Anton', Impact, sans-serif", fontSize: 17, letterSpacing: 0.5, textTransform: "uppercase", color: "#fff", lineHeight: 0.95, textAlign: "center", width: "100%" }}>
          VAN
          <span style={{ color: "transparent", WebkitTextStroke: "1px #fff" }}>GUARD</span>
        </div>
        <div style={{ position: "relative", marginTop: 5, height: 3, width: 34, background: brand }} />
      </div>
    );
  // The three video-led styles. The swatch can't play a clip, so it stands in
  // with a soft "footage" wash plus the frosted panel that is each one's tell.
  if (k === "aurora")
    return (
      <div style={{ ...base, background: `linear-gradient(150deg, #101018, ${brand}66 45%, #07070a)` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.8), transparent 70%)" }} />
        <div style={{ position: "absolute", insetInlineStart: 10, top: 8, height: 13, width: 46, borderRadius: 999, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.32)", backdropFilter: "blur(2px)" }} />
        <div style={{ position: "relative" }}>{bar(brand, "#fff")}</div>
      </div>
    );
  if (k === "horizon")
    return (
      <div style={{ ...base, background: `linear-gradient(200deg, #0d1117 25%, ${brand}77)` }}>
        <div style={{ position: "absolute", insetInlineEnd: 9, bottom: 10, height: 16, width: 34, borderRadius: 6, background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.3)" }} />
        <div style={{ display: "flex", gap: 2, marginBottom: 5 }}>
          {[1, 0.75, 0.5, 0.3].map((o, i) => (
            <span key={i} style={{ height: 7, width: 9, borderRadius: 2, background: "#fff", opacity: o }} />
          ))}
        </div>
        <div style={{ height: 5, width: "34%", borderRadius: 3, background: "#fff", opacity: 0.4 }} />
      </div>
    );
  if (k === "nova")
    return (
      <div style={{ ...base, background: "hsl(260 87% 6%)", justifyContent: "center", alignItems: "center", paddingBottom: 6 }}>
        <div style={{ position: "absolute", inset: "18% 8%", background: "#030712", filter: "blur(12px)", opacity: 0.9 }} />
        <div style={{ position: "relative", fontSize: 19, fontWeight: 600, letterSpacing: "-0.03em", color: "#f4f2ef", lineHeight: 1 }}>
          <span>Nova</span>
          <span style={{ backgroundImage: `linear-gradient(to left, ${brand}, #fcd34d)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}> AI</span>
        </div>
        <div style={{ position: "absolute", insetInline: 8, bottom: 7, display: "flex", gap: 5 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ height: 5, flex: 1, borderRadius: 2, background: "rgba(255,255,255,.22)" }} />
          ))}
        </div>
      </div>
    );
  if (k === "soda")
    return (
      <div style={{ ...base, background: `radial-gradient(circle at center, ${brand} 0%, color-mix(in srgb, ${brand} 30%, #001014) 50%, #000 100%)` }}>
        {/* The product disc in the middle, with three of the drifting orbs
            and a couple of the bubbles that rise past them. */}
        <div style={{ position: "absolute", left: "50%", top: "48%", width: 26, height: 32, borderRadius: 8, transform: "translate(-50%,-50%)", background: "radial-gradient(circle at 32% 26%, rgba(255,255,255,.8), rgba(255,255,255,.25) 55%, transparent)", boxShadow: "0 6px 14px rgba(0,0,0,.45)" }} />
        {[[14, 12, 13], [58, 46, 9], [22, 52, 7]].map(([l, t, s], i) => (
          <span key={i} style={{ position: "absolute", left: `${l}%`, top: `${t}%`, width: s, height: s, borderRadius: "50%", background: "radial-gradient(circle at 32% 26%, rgba(255,255,255,.6), rgba(255,255,255,.15) 60%, transparent)" }} />
        ))}
        {[[30, 4], [72, 3]].map(([l, s], i) => (
          <span key={`b${i}`} style={{ position: "absolute", left: `${l}%`, bottom: 8 + i * 12, width: s, height: s, borderRadius: "50%", background: "rgba(255,255,255,.5)" }} />
        ))}
        {bar(brand, "#fff")}
      </div>
    );
  if (k === "denim")
    return (
      <div style={{ ...base, background: "#000", flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <div style={{ position: "absolute", insetInline: 0, top: 0, height: 2, background: brand }} />
        <div style={{ flex: 1 }}>{bar(brand, "#fff")}</div>
        {/* The product card with its corner tag. */}
        <div style={{ width: 30, height: 44, borderRadius: 9, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.1)", position: "relative" }}>
          <span style={{ position: "absolute", insetInlineEnd: 3, bottom: 3, width: 12, height: 6, borderRadius: 2, background: brand }} />
        </div>
      </div>
    );
  return <div style={{ ...base, background: `linear-gradient(180deg, ${brand}26, #fff)` }}>{bar(brand, "#18181b")}</div>;
}

export function HeroStylePicker({
  businessId,
  brandHex,
  current,
}: {
  businessId: string;
  brandHex: string;
  current: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState(current || "spotlight");
  const [busy, setBusy] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [, startTransition] = useTransition();

  function aiPick() {
    setAiBusy(true);
    startTransition(async () => {
      const res = await suggestHeroStyleAction(businessId);
      if (res.error) toast.error(res.error);
      else if (res.style) {
        setSel(res.style);
        toast.success(`ה-AI בחר: ${res.style}${res.reason ? ` — ${res.reason}` : ""}`);
        router.refresh();
      }
      setAiBusy(false);
    });
  }

  function choose(k: string) {
    const prev = sel;
    setSel(k);
    setBusy(k);
    startTransition(async () => {
      const res = await setHeroStyleAction(businessId, k);
      if (res.error) {
        toast.error(res.error);
        // Roll back the optimistic selection — otherwise the tile stays
        // checked (and its ✓ shown) for a style that was never saved, and
        // stays that way until the owner happens to reload the page.
        setSel(prev);
      } else {
        toast.success("סגנון ה-Hero עודכן ✓");
        router.refresh();
      }
      setBusy(null);
    });
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">סגנון ה-Hero של האתר</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={aiPick} disabled={aiBusy || busy !== null}>
            {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            התאמה אוטומטית ב-AI
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          בחרו את מבנה אזור הפתיחה — הצבעים נלקחים אוטומטית מהמותג שלכם. Aurora, Horizon,
          Nova ו-Soda בנויים סביב תמונת הנושא של העסק, אז שווה להעלות תמונה טובה שלכם
          בלשונית &quot;עיצוב&quot;.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STYLES.map((s) => {
            const active = sel === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => choose(s.key)}
                disabled={busy !== null}
                className={`rounded-xl border p-2 text-right transition ${active ? "border-primary ring-1 ring-primary" : "border-input hover:border-muted-foreground/40"}`}
              >
                <Preview k={s.key} brand={brandHex} />
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="text-xs font-medium">{s.label}</span>
                  {busy === s.key ? <Loader2 className="size-3.5 animate-spin text-primary" /> : active ? <Check className="size-3.5 text-primary" /> : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{s.desc}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
