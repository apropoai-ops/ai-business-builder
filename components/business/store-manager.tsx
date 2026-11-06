"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, Package, Eye, EyeOff, Sparkles, Wand2, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deleteProductAction, toggleProductAction } from "@/lib/actions/store";
import { ProductMarketing } from "@/components/business/product-marketing";
import { VariantsEditor } from "@/components/business/variants-editor";
import type { Product, ProductVariant } from "@/types/database";

/** The effective (display) price — sale price when it's a real discount. */
function effectivePrice(p: Product): number | null {
  if (p.sale_price != null && p.price != null && p.sale_price < p.price) return p.sale_price;
  return p.price;
}

/**
 * The product CATALOG — list, toggle, delete, and per-product AI tools.
 * Adding a new product lives on its own screen now
 * (components/business/add-product-form.tsx, app/(dashboard)/businesses/[businessId]/new-product) —
 * split out so it isn't competing with a catalog that can grow to hundreds
 * of cards.
 */
export function StoreManager({
  businessId,
  products,
  variantsByProduct = {},
}: {
  businessId: string;
  products: Product[];
  variantsByProduct?: Record<string, ProductVariant[]>;
}) {
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aiId, setAiId] = useState<string | null>(null);
  const [aiPhotoId, setAiPhotoId] = useState<string | null>(null);
  const [attrId, setAttrId] = useState<string | null>(null);
  const router = useRouter();

  async function aiImage(id: string) {
    setAiId(id);
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${id}/image`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("האיור נוצר ✓");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירת התמונה נכשלה");
    } finally {
      setAiId(null);
    }
  }

  /** Realistic AI product photo — a photoreal alternative to the flat-illustration aiImage() above. */
  async function aiPhoto(id: string) {
    setAiPhotoId(id);
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${id}/photo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("תמונת המוצר נוצרה ✓");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירת התמונה נכשלה");
    } finally {
      setAiPhotoId(null);
    }
  }

  async function aiAttributes(id: string) {
    setAttrId(id);
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${id}/attributes`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("מאפיינים נוספו לתגיות ✓");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ניתוח המאפיינים נכשל");
    } finally {
      setAttrId(null);
    }
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteProductAction(businessId, id);
      if (res.error) toast.error(res.error);
      setBusyId(null);
    });
  }

  function toggle(p: Product) {
    setBusyId(p.id);
    startTransition(async () => {
      await toggleProductAction(businessId, p.id, !p.active);
      setBusyId(null);
    });
  }

  if (products.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Package className="size-7 text-muted-foreground/50" />
          עדיין אין מוצרים — הוסיפו את הראשון ב&quot;הוספת מוצר&quot; ויופיע כאן ובאתר שלכם
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => {
        const onSale = p.sale_price != null && p.price != null && p.sale_price < p.price;
        return (
          <Card key={p.id} className={p.active ? "" : "opacity-55"}>
            <CardContent className="space-y-2 p-4">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="h-32 w-full rounded-lg bg-muted object-contain p-1" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-lg bg-muted">
                  <Package className="size-8 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{p.name}</div>
                  {effectivePrice(p) !== null && (
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="text-primary">₪{effectivePrice(p)!.toLocaleString()}</span>
                      {onSale && (
                        <span className="text-xs font-normal text-muted-foreground line-through">
                          ₪{p.price!.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.status === "draft" && <Badge variant="outline" className="text-[10px]">טיוטה</Badge>}
                  {p.status === "hidden" && <Badge variant="outline" className="text-[10px]">מוסתר</Badge>}
                  {onSale && <Badge className="bg-red-600 text-[10px] hover:bg-red-600">מבצע</Badge>}
                  {!p.in_stock && <Badge variant="outline" className="text-[10px]">אזל</Badge>}
                </div>
              </div>
              {p.category && (
                <div className="text-xs text-muted-foreground">
                  {p.category}{p.subcategory ? ` · ${p.subcategory}` : ""}
                </div>
              )}
              {(p.brand || p.sku) && (
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  {p.brand && <span className="font-medium">{p.brand}</span>}
                  {p.sku && <span>מק&quot;ט {p.sku}</span>}
                </div>
              )}
              {p.stock_qty != null && (
                <div className={`text-[11px] ${p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold ? "font-medium text-amber-600" : "text-muted-foreground"}`}>
                  מלאי: {p.stock_qty}
                  {p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold ? " ⚠️ נמוך" : ""}
                </div>
              )}
              {p.cost_price != null && p.price != null && p.cost_price > 0 && (
                <div className="text-[11px] text-emerald-700">
                  רווח: ₪{(p.price - p.cost_price).toLocaleString("he-IL")} ({Math.round(((p.price - p.cost_price) / p.price) * 100)}%)
                </div>
              )}
              {(p.sizes?.length || p.colors?.length) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {p.sizes?.length ? <span>מידות: {p.sizes.join(", ")}</span> : null}
                  {p.colors?.length ? (
                    <span className="flex items-center gap-0.5">
                      {p.colors.map((c) => (
                        <span
                          key={c.hex}
                          title={c.name}
                          className="inline-block size-3 rounded-full border"
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </span>
                  ) : null}
                </div>
              )}
              {Object.keys(p.attributes ?? {}).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(p.attributes).map(([k, v]) => (
                    <span key={k} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {k}: {v}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-1 pt-1">
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-primary"
                  onClick={() => aiImage(p.id)} disabled={aiId === p.id} title="צור איור AI וקטורי למוצר">
                  {aiId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  איור AI
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-primary"
                  onClick={() => aiPhoto(p.id)} disabled={aiPhotoId === p.id} title="צור תמונת AI ריאליסטית למוצר">
                  {aiPhotoId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                  תמונת AI
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-primary"
                  onClick={() => aiAttributes(p.id)} disabled={attrId === p.id} title="הוסף מאפייני AI (גזרה/בד/עונה/מגדר/קולקציה)">
                  {attrId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                  מאפייני AI
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => toggle(p)} disabled={busyId === p.id}>
                  {p.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(p.id)} disabled={busyId === p.id}>
                  {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              </div>
              <VariantsEditor
                businessId={businessId}
                productId={p.id}
                initial={variantsByProduct[p.id] ?? []}
              />
              <ProductMarketing businessId={businessId} productId={p.id} productName={p.name} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
