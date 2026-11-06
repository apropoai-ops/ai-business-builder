"use client";

import { useMemo, useState } from "react";
import { ShoppingBag, Check, Minus, Plus, X, Eye } from "lucide-react";

import { useCart, parseEngraving } from "@/components/public/cart-context";
import { trackRecentlyViewed } from "@/components/public/recently-viewed";
import type { Json, ProductColor, ProductVariant } from "@/types/database";
import { CHIP_HAIRLINE, inkOn } from "@/lib/storefront-brand";

const ENGRAVING_LABEL_DEFAULT = "טקסט לחריטה";
const ENGRAVING_MAXCHARS_DEFAULT = 25;
const ENGRAVING_MAXCHARS_HARD_CAP = 60;

export function AddToCartButton({
  productId,
  name,
  brand,
  unitPrice,
  image,
  sizes,
  colors,
  inStock = true,
  slug,
  regularPrice = null,
  salePrice = null,
  variants = null,
  preorder = false,
  engraving = null,
  catalogOnly = false,
}: {
  productId: string;
  name: string;
  brand: string;
  unitPrice: number | null;
  image: string | null;
  sizes?: string[] | null;
  colors?: ProductColor[] | null;
  inStock?: boolean;
  slug?: string;
  regularPrice?: number | null;
  salePrice?: number | null;
  variants?: ProductVariant[] | null;
  preorder?: boolean;
  /** Raw `products.engraving` jsonb config — parsed defensively below. */
  engraving?: Json | null;
  /** Shop window: the price still shows, the product cannot be bought. */
  catalogOnly?: boolean;
}) {
  const { add } = useCart();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engravingTexts, setEngravingTexts] = useState<string[]>(["", ""]);

  const engravingCfg = useMemo(() => parseEngraving(engraving), [engraving]);
  const engravingMaxChars = Math.min(
    ENGRAVING_MAXCHARS_HARD_CAP,
    engravingCfg?.maxChars ?? ENGRAVING_MAXCHARS_DEFAULT,
  );
  const engravingLabel = engravingCfg?.label ?? ENGRAVING_LABEL_DEFAULT;
  const engravingFields = engravingCfg?.fields ?? 1;
  const engravingMissing =
    !!engravingCfg?.enabled &&
    !!engravingCfg.required &&
    engravingTexts.slice(0, engravingFields).some((t) => !t.trim());

  function setEngravingAt(idx: number, value: string) {
    setEngravingTexts((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  // Inventory-tracked products derive their size/color options (and stock) from
  // the variant rows; otherwise fall back to the product's sizes/colors arrays.
  const tracked = (variants?.length ?? 0) > 0;
  const variantSizes = tracked
    ? [...new Set(variants!.map((v) => v.size).filter((s): s is string => !!s))]
    : sizes ?? [];
  const variantColorNames = tracked
    ? [...new Set(variants!.map((v) => v.color).filter((c): c is string => !!c))]
    : null;
  const effSizes = tracked ? variantSizes : sizes ?? [];
  const effColors = tracked
    ? (colors ?? []).filter((c) => variantColorNames!.includes(c.name))
    : colors ?? [];

  const hasSizes = effSizes.length > 0;
  const hasColors = effColors.length > 0;

  /** Resolves the chosen size/color to a concrete variant row. */
  function matchVariant(): ProductVariant | null {
    if (!tracked) return null;
    return (
      variants!.find(
        (v) => (v.size ?? null) === (size ?? null) && (v.color ?? null) === (color ?? null),
      ) ?? null
    );
  }

  function submit() {
    setError(null);
    if (hasSizes && !size) return setError("נא לבחור מידה");
    if (hasColors && !color) return setError("נא לבחור צבע");
    if (engravingMissing) return setError("נא למלא טקסט לחריטה");

    let variantId: string | null = null;
    if (tracked) {
      const v = matchVariant();
      if (!v) return setError("הצירוף שנבחר אינו זמין");
      if (!preorder && v.stock_qty < qty) {
        return setError(v.stock_qty <= 0 ? "אזל מהמלאי" : `נותרו ${v.stock_qty} יחידות בלבד`);
      }
      variantId = v.id;
    }

    const variant =
      [size && `מידה: ${size}`, color && `צבע: ${color}`].filter(Boolean).join(" · ") || null;
    const engravingValue = engravingCfg?.enabled
      ? engravingTexts
          .slice(0, engravingFields)
          .map((t) => t.trim())
          .filter(Boolean)
          .join(" | ") || null
      : null;
    add({ productId, name, unitPrice, variant, variantId, image, engraving: engravingValue }, qty);
    if (slug) {
      trackRecentlyViewed(slug, {
        id: productId,
        name,
        image,
        price: regularPrice ?? unitPrice,
        sale_price: salePrice,
      });
    }
    setAdded(true);
    setOpen(false);
    setSize(null);
    setColor(null);
    setQty(1);
    setEngravingTexts(["", ""]);
    setTimeout(() => setAdded(false), 1800);
  }

  // Shop window — checked before stock, because when nothing on the site can
  // be bought, whether this particular item is in stock is not the story.
  if (catalogOnly) {
    return (
      <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-2 text-sm font-semibold text-zinc-500">
        <Eye className="size-4" />
        לצפייה בלבד
      </div>
    );
  }

  // Out of stock and not available for pre-order → disabled.
  if (!inStock && !preorder) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-400"
      >
        אזל מהמלאי
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        data-el="btn-primary"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: brand, color: inkOn(brand) }}
      >
        {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
        {added ? "נוסף לסל!" : !inStock && preorder ? "הזמנה מוקדמת" : "הוספה לסל"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800">בחירת אפשרויות</span>
        <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
          <X className="size-4" />
        </button>
      </div>

      {hasSizes && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-500">מידה:</span>
          <div className="flex flex-wrap gap-1.5">
            {effSizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="min-w-9 rounded-lg border px-2.5 py-1 text-sm font-medium"
                style={
                  size === s
                    ? { borderColor: brand, color: brand, backgroundColor: `${brand}10` }
                    : { borderColor: CHIP_HAIRLINE }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasColors && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-500">צבע:</span>
          <div className="flex flex-wrap gap-1.5">
            {effColors.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.name)}
                title={c.name}
                className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                style={
                  color === c.name
                    ? { borderColor: brand, backgroundColor: `${brand}10`, fontWeight: 600 }
                    : { borderColor: CHIP_HAIRLINE }
                }
              >
                <span className="inline-block size-3.5 rounded-full border" style={{ backgroundColor: c.hex }} />
                {c.name}
                {color === c.name && <Check className="size-3" style={{ color: brand }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {engravingCfg?.enabled && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-500">
            {engravingLabel}
            {engravingCfg.required ? " *" : ""}
          </span>
          {Array.from({ length: engravingFields }).map((_, idx) => (
            <div key={idx} className="space-y-1">
              <input
                id={`engraving-${productId}-${idx}`}
                type="text"
                dir="auto"
                value={engravingTexts[idx] ?? ""}
                onChange={(e) => setEngravingAt(idx, e.target.value.slice(0, engravingMaxChars))}
                maxLength={engravingMaxChars}
                placeholder={
                  engravingFields > 1 ? `חריטה ${idx + 1} (למשל: שם ${idx + 1})` : engravingLabel
                }
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none"
              />
              <div className="flex items-center justify-end text-[11px] text-zinc-400">
                <span>
                  {(engravingTexts[idx] ?? "").length}/{engravingMaxChars}
                </span>
              </div>
            </div>
          ))}
          {engravingMissing && (
            <p className="text-[11px] text-amber-600">
              {engravingFields > 1 ? "נא למלא את כל שדות החריטה" : "נא למלא טקסט לחריטה"}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">כמות:</span>
        <div className="flex items-center rounded-lg border border-zinc-200">
          <button type="button" aria-label="הפחתה" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40">
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-8 text-center text-sm font-semibold">{qty}</span>
          <button type="button" aria-label="הוספה" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99} className="px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40">
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={engravingMissing}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: brand, color: inkOn(brand) }}
      >
        <ShoppingBag className="size-4" />
        הוספה לסל
      </button>
    </div>
  );
}
