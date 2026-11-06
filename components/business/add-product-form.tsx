"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Loader2, Check, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProductAction } from "@/lib/actions/store";
import { ProductImagesField } from "@/components/business/product-images-field";
import { ProductAttributesField } from "@/components/business/product-attributes-field";
import type { ProductColor } from "@/types/database";

/** Preset clothing colors the owner can toggle (name + swatch). */
const PRESET_COLORS: ProductColor[] = [
  { name: "שחור", hex: "#000000" },
  { name: "לבן", hex: "#FFFFFF" },
  { name: "אפור", hex: "#9CA3AF" },
  { name: "כחול", hex: "#2563EB" },
  { name: "נייבי", hex: "#1E3A8A" },
  { name: "אדום", hex: "#DC2626" },
  { name: "ירוק", hex: "#16A34A" },
  { name: "בז'", hex: "#D6BCA0" },
  { name: "חום", hex: "#92400E" },
  { name: "ורוד", hex: "#EC4899" },
  { name: "צהוב", hex: "#FACC15" },
  { name: "סגול", hex: "#7C3AED" },
];

/**
 * Everything involved in adding a NEW product — manual form + AI-generate —
 * split out of store-manager.tsx (which now only lists/manages products
 * already in the catalog) so this has its own dedicated screen
 * (app/(dashboard)/businesses/[businessId]/new-product), reachable straight
 * from the sidebar instead of buried under the catalog.
 */
export function AddProductForm({ businessId }: { businessId: string }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  // Bumped after a successful submit to remount the images/attributes
  // fields — they hold local File/row state a form.reset() can't touch.
  const [formKey, setFormKey] = useState(0);
  const [colors, setColors] = useState<ProductColor[]>([]);
  const [inStock, setInStock] = useState(true);
  const [engravingEnabled, setEngravingEnabled] = useState(false);
  const [engravingLabel, setEngravingLabel] = useState("טקסט לחריטה");
  const [engravingMaxChars, setEngravingMaxChars] = useState(25);
  const [engravingRequired, setEngravingRequired] = useState(false);
  const [engravingFields, setEngravingFields] = useState(1);
  const [aiName, setAiName] = useState("");
  const [aiDetails, setAiDetails] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const router = useRouter();

  async function aiGenerate() {
    if (aiName.trim().length < 2) {
      toast.error("נא להזין שם מוצר");
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: aiName, details: aiDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("המוצר נוצר ב-AI ✓ — אפשר לראות אותו בעמוד החנות");
      setAiName("");
      setAiDetails("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "היצירה נכשלה");
    } finally {
      setAiBusy(false);
    }
  }

  function toggleColor(c: ProductColor) {
    setColors((prev) =>
      prev.some((x) => x.hex === c.hex) ? prev.filter((x) => x.hex !== c.hex) : [...prev, c],
    );
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await saveProductAction(businessId, formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success("המוצר נוסף ✓ — אפשר לראות אותו בעמוד החנות");
        formRef.current?.reset();
        setColors([]);
        setInStock(true);
        setEngravingEnabled(false);
        setEngravingLabel("טקסט לחריטה");
        setEngravingMaxChars(25);
        setEngravingRequired(false);
        setFormKey((k) => k + 1);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* AI product upload */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Wand2 className="size-4" />
            העלאת מוצר ב-AI
          </div>
          <p className="text-xs text-muted-foreground">
            הקלידו שם מוצר (ופרטים אם בא לכם) וה-AI ייצר אוטומטית כותרת, תיאור, קטגוריה, תגיות, צבעים, מידות, מחיר מומלץ — וגם תמונת מוצר ריאליסטית.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={aiName} onChange={(e) => setAiName(e.target.value)}
              placeholder="שם המוצר (למשל: חולצת אוברסייז כותנה)" />
            <Input value={aiDetails} onChange={(e) => setAiDetails(e.target.value)}
              placeholder="פרטים נוספים (אופציונלי)" />
          </div>
          <Button onClick={aiGenerate} disabled={aiBusy} className="gap-1.5">
            {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {aiBusy ? "ה-AI יוצר מוצר..." : "צור מוצר ב-AI"}
          </Button>
        </CardContent>
      </Card>

      {/* Add product */}
      <Card>
        <CardContent className="py-4">
          <form ref={formRef} action={submit} className="space-y-3">
            <div className="text-sm font-semibold">הוספת מוצר חדש</div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="name" placeholder="שם המוצר *" required />
              <Input name="category" placeholder="קטגוריה (למשל: חולצות, מכנסיים)" />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="price" type="number" step="0.01" min="0" placeholder="מחיר רגיל (₪)" />
              <Input name="sale_price" type="number" step="0.01" min="0" placeholder="מחיר מבצע (₪, אופציונלי)" />
              <Input name="cost_price" type="number" step="0.01" min="0" placeholder="מחיר עלות (₪, לרווח)" />
              <Input name="wholesale_price" type="number" step="0.01" min="0" placeholder="מחיר סיטונאי (₪)" />
              <Input name="video_url" dir="ltr" placeholder="קישור וידאו (YouTube/MP4)" />
            </div>

            <Textarea name="description" placeholder="תיאור קצר" rows={2} />
            <Textarea name="full_description" placeholder="תיאור מלא (אופציונלי)" rows={3} />

            <div className="grid gap-2 sm:grid-cols-3">
              <Input name="brand" placeholder="מותג" />
              <Input name="subcategory" placeholder="תת-קטגוריה" />
              <Input name="sku" placeholder='מק"ט (SKU)' />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="barcode" dir="ltr" placeholder="ברקוד (EAN/UPC, אופציונלי)" />
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="track_inventory" value="true" className="size-4" />
                  ניהול מלאי לפי וריאציה
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="preorder" value="true" className="size-4" />
                  הזמנה מוקדמת
                </label>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Input name="stock_qty" type="number" min="0" step="1" placeholder="כמות במלאי" />
              <Input name="low_stock_threshold" type="number" min="0" step="1" placeholder="התראת מלאי נמוך" />
              <select name="status" defaultValue="active"
                className="rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                <option value="active">פעיל (מוצג באתר)</option>
                <option value="draft">טיוטה</option>
                <option value="hidden">מוסתר</option>
              </select>
            </div>

            <Input name="sizes" placeholder="מידות מופרדות בפסיק (למשל: S,M,L,XL)" />

            {/* Colors */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">צבעים זמינים:</div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => {
                  const on = colors.some((x) => x.hex === c.hex);
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => toggleColor(c)}
                      title={c.name}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition ${
                        on ? "border-primary bg-primary/10 font-semibold" : "border-input"
                      }`}
                    >
                      <span
                        className="inline-block size-3.5 rounded-full border"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                      {on && <Check className="size-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="colors" value={JSON.stringify(colors)} />
            </div>

            {/* Engraving (personalization) */}
            <details className="group rounded-lg border p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                ✒️ חריטה אישית
              </summary>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={engravingEnabled}
                    onChange={(e) => setEngravingEnabled(e.target.checked)}
                    className="size-4"
                  />
                  אפשר חריטה אישית במוצר
                </label>
                {engravingEnabled && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={engravingLabel}
                      onChange={(e) => setEngravingLabel(e.target.value)}
                      placeholder="כותרת השדה ללקוח"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={engravingMaxChars}
                      onChange={(e) => setEngravingMaxChars(Number(e.target.value) || 25)}
                      placeholder="מקסימום תווים"
                    />
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={engravingRequired}
                        onChange={(e) => setEngravingRequired(e.target.checked)}
                        className="size-4"
                      />
                      חובה למלא כדי להזמין
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={engravingFields === 2}
                        onChange={(e) => setEngravingFields(e.target.checked ? 2 : 1)}
                        className="size-4"
                      />
                      2 שדות חריטה (למשל סט זוגי)
                    </label>
                  </div>
                )}
                <input
                  type="hidden"
                  name="engraving"
                  value={JSON.stringify({
                    enabled: engravingEnabled,
                    label: engravingLabel,
                    maxChars: engravingMaxChars,
                    required: engravingRequired,
                    fields: engravingFields,
                  })}
                />
              </div>
            </details>

            {/* Custom spec fields */}
            <ProductAttributesField key={formKey} />

            {/* Gallery + stock */}
            <ProductImagesField key={formKey} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                className="size-4"
              />
              במלאי
            </label>
            <input type="hidden" name="in_stock" value={inStock ? "true" : "false"} />

            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              הוסף מוצר
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
