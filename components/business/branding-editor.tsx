"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateBrandingAction } from "@/lib/actions/design";
import type { BrandAssets } from "@/types/database";

type Color = { name: string; hex: string; usage: string };
type Typo = { primary: { font: string; usage: string }; secondary: { font: string; usage: string } };

export function BrandingEditor({
  businessId,
  assets,
}: {
  businessId: string;
  assets: BrandAssets;
}) {
  const [name, setName] = useState(assets.brand_name ?? "");
  const [slogan, setSlogan] = useState(assets.slogan ?? "");
  const [mission, setMission] = useState(assets.mission ?? "");
  const [vision, setVision] = useState(assets.vision ?? "");
  const [voice, setVoice] = useState(assets.brand_voice ?? "");
  const [personality, setPersonality] = useState<string[]>(
    (assets.personality as string[] | null) ?? [],
  );
  const [colors, setColors] = useState<Color[]>(
    (assets.color_palette as Color[] | null) ?? [{ name: "ראשי", hex: "#2563EB", usage: "צבע מותג" }],
  );
  const [typo, setTypo] = useState<Typo>(
    (assets.typography as Typo | null) ?? {
      primary: { font: "Heebo", usage: "כותרות" },
      secondary: { font: "Assistant", usage: "טקסט" },
    },
  );
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateBrandingAction(businessId, {
        brand_name: name, slogan, mission, vision, brand_voice: voice,
        personality, color_palette: colors, typography: typo,
      });
      if (res.error) toast.error(res.error);
      else toast.success("המיתוג נשמר — האתר החי התעדכן ✓");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card><CardContent className="space-y-3 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">שם המותג</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">סלוגן</label>
            <Input value={slogan} onChange={(e) => setSlogan(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">משימה</label>
          <Textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">חזון</label>
          <Textarea value={vision} onChange={(e) => setVision(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">קול המותג</label>
          <Textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={2} />
        </div>
      </CardContent></Card>

      {/* Personality */}
      <Card><CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">אישיות המותג</div>
          <Button variant="ghost" size="sm" className="gap-1"
            onClick={() => setPersonality((p) => [...p, ""])}>
            <Plus className="size-3.5" /> הוסף תכונה
          </Button>
        </div>
        {personality.length === 0 && (
          <p className="text-xs text-muted-foreground">למשל: עכשווי, אמין, נגיש, יוקרתי</p>
        )}
        <div className="flex flex-wrap gap-2">
          {personality.map((trait, i) => (
            <div key={i} className="flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-1">
              <input
                value={trait}
                onChange={(e) => setPersonality((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="תכונה"
                className="w-24 bg-transparent text-sm outline-none"
              />
              <button type="button" aria-label="הסרה"
                onClick={() => setPersonality((arr) => arr.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </CardContent></Card>

      {/* Colors */}
      <Card><CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">פלטת צבעים</div>
          <Button variant="ghost" size="sm" className="gap-1"
            onClick={() => setColors((c) => [...c, { name: "", hex: "#888888", usage: "" }])}>
            <Plus className="size-3.5" /> הוסף צבע
          </Button>
        </div>
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#888888"}
              onChange={(e) => setColors((arr) => arr.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
              className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
            />
            <Input value={c.hex} dir="ltr" className="w-26 font-mono text-xs"
              onChange={(e) => setColors((arr) => arr.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} />
            <Input value={c.name} placeholder="שם"
              onChange={(e) => setColors((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input value={c.usage} placeholder="שימוש"
              onChange={(e) => setColors((arr) => arr.map((x, j) => (j === i ? { ...x, usage: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setColors((arr) => arr.filter((_, j) => j !== i))} disabled={colors.length <= 1}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          הצבע הכהה הראשון משמש כצבע הראשי של האתר, הכפתורים והלוגו.
        </p>
      </CardContent></Card>

      {/* Typography */}
      <Card><CardContent className="space-y-3 py-4">
        <div className="text-sm font-semibold">טיפוגרפיה (Google Fonts)</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">פונט כותרות</label>
            <Input value={typo.primary.font} dir="ltr"
              onChange={(e) => setTypo((t) => ({ ...t, primary: { ...t.primary, font: e.target.value } }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">פונט טקסט</label>
            <Input value={typo.secondary.font} dir="ltr"
              onChange={(e) => setTypo((t) => ({ ...t, secondary: { ...t.secondary, font: e.target.value } }))} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          פונטים עם תמיכה בעברית: Heebo, Assistant, Rubik, Varela Round, Secular One, Alef
        </p>
      </CardContent></Card>

      <Button onClick={save} disabled={isPending} className="gap-2 self-start">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        שמור מיתוג (מעדכן את האתר החי)
      </Button>
    </div>
  );
}
