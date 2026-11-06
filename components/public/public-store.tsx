"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ShoppingBag, Package, Search, SlidersHorizontal, Check, X, ZoomIn, Play } from "lucide-react";

import { AddToCartButton } from "@/components/public/add-to-cart-button";
import { WishlistButton } from "@/components/public/wishlist-button";
import { RecentlyViewed } from "@/components/public/recently-viewed";
import { SizeGuide } from "@/components/public/size-guide";
import type { Product, ProductVariant } from "@/types/database";
import { CHIP_HAIRLINE, inkOn } from "@/lib/storefront-brand";

/** The effective (display) price — sale price when it's a real discount. */
function effectivePrice(p: Product): number | null {
  if (p.sale_price != null && p.price != null && p.sale_price < p.price) return p.sale_price;
  return p.price;
}

/** Discount percentage (rounded) when the product has a real sale price, else null. */
function discountPct(p: Product): number | null {
  if (p.sale_price == null || p.price == null || p.sale_price >= p.price || p.price <= 0) return null;
  return Math.round((1 - p.sale_price / p.price) * 100);
}

const NEW_WINDOW_DAYS = 30;

/** True when the product was created within the last {@link NEW_WINDOW_DAYS} days. */
function isNew(p: Product): boolean {
  if (!p.created_at) return false;
  const created = new Date(p.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Converts a YouTube watch/share URL to an embeddable URL; null if not YouTube. */
function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/** Fullscreen overlay for zooming a product image or playing its video. */
function MediaLightbox({
  media,
  onClose,
}: {
  media: { type: "img" | "video"; src: string };
  onClose: () => void;
}) {
  const yt = media.type === "video" ? youtubeEmbed(media.src) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // Colours stay explicit: this renders through a portal on <body>, OUTSIDE
    // the [data-tier] subtree, so it inherits none of the tier's remaps.
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="סגירה"
        onClick={onClose}
        className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/90 text-zinc-800"
      >
        <X className="size-5" />
      </button>
      <div className="max-h-[90vh] w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {media.type === "img" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.src} alt="" className="mx-auto max-h-[90vh] w-auto rounded-lg object-contain" />
        ) : yt ? (
          <div className="relative aspect-video w-full">
            <iframe
              src={yt}
              title="וידאו מוצר"
              className="absolute inset-0 size-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <video src={media.src} controls autoPlay className="mx-auto max-h-[90vh] w-auto rounded-lg" />
        )}
      </div>
    </div>
  );
}

function ProductCard({
  p,
  brand,
  slug,
  variants,
  catalogOnly = false,
}: {
  p: Product;
  brand: string;
  slug: string;
  variants?: ProductVariant[];
  catalogOnly?: boolean;
}) {
  const gallery = p.images?.length ? p.images : p.image_url ? [p.image_url] : [];
  const [active, setActive] = useState(gallery[0] ?? null);
  const [zoom, setZoom] = useState<{ type: "img" | "video"; src: string } | null>(null);
  const onSale = p.sale_price != null && p.price != null && p.sale_price < p.price;
  const eff = effectivePrice(p);
  const pct = discountPct(p);
  const fresh = isNew(p);

  return (
    <div data-el="product-card" className="svc-card flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="relative">
        <Link href={`/s/${slug}/product/${p.id}`} aria-label={p.name} className="block">
          {active ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active} alt={p.name} className="h-56 w-full bg-white object-contain p-2" />
          ) : (
            <div className="flex h-56 w-full items-center justify-center" style={{ background: `${brand}10` }}>
              <Package className="size-10" style={{ color: brand }} />
            </div>
          )}
        </Link>
        {/* Badges start-side, media controls end-side — they used to share the
            same corner and the zoom button covered the sale badge. */}
        <div className="absolute start-3 top-3 z-10 flex flex-col items-start gap-1">
          {onSale && (
            <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
              {pct != null ? `${pct}% הנחה` : "מבצע"}
            </span>
          )}
          {fresh && (
            <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: brand, color: inkOn(brand) }}>
              חדש
            </span>
          )}
        </div>
        {!p.in_stock && (
          <span className="absolute bottom-3 end-3 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs font-semibold text-white">
            אזל
          </span>
        )}
        {!p.in_stock && (
          // pointer-events-none: this sat on top of the <Link> and swallowed
          // every click on the image, including for preorderable products.
          // Dark rather than white/40 — the tier only remaps `.bg-white`, so on
          // a #111214 card the white wash rendered as a milky halo.
          <div className="pointer-events-none absolute inset-0 bg-black/45" />
        )}
        {/* Zoom + video controls */}
        <div className="absolute end-2 top-2 flex gap-1">
          {active && (
            <button
              type="button"
              aria-label="הגדלה"
              onClick={() => setZoom({ type: "img", src: active })}
              className="flex size-8 items-center justify-center rounded-full bg-white/85 text-zinc-700 shadow hover:bg-white"
            >
              <ZoomIn className="size-4" />
            </button>
          )}
          {p.video_url && (
            <button
              type="button"
              aria-label="וידאו"
              onClick={() => setZoom({ type: "video", src: p.video_url! })}
              className="flex size-8 items-center justify-center rounded-full bg-white/85 text-zinc-700 shadow hover:bg-white"
            >
              <Play className="size-4" />
            </button>
          )}
        </div>
        {/* No wishlist on a shop window — saving something you can never buy
            is a dead end, and the drawer that opens it is gone from the header. */}
        {!catalogOnly && (
          <div className="absolute bottom-2 start-2">
            <WishlistButton productId={p.id} name={p.name} image={p.image_url} unitPrice={eff} brand={brand} />
          </div>
        )}
      </div>

      {/* Portalled to <body>. The card carries a hover/focus transform (both
          .svc-card and the tier's [data-el="product-card"] rule), and any
          transform makes the card a containing block for position:fixed — so
          rendered in place the lightbox was trapped inside the card and clipped
          by its overflow-hidden. Same reason cart-drawer portals. */}
      {zoom &&
        typeof document !== "undefined" &&
        createPortal(
          <MediaLightbox media={zoom} onClose={() => setZoom(null)} />,
          document.body,
        )}

      {/* Gallery thumbnails */}
      {gallery.length > 1 && (
        <div className="flex gap-1.5 px-3 pt-2">
          {gallery.slice(0, 5).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(src)}
              className="size-12 shrink-0 overflow-hidden rounded-lg border transition"
              style={{ borderColor: active === src ? brand : CHIP_HAIRLINE }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full bg-white object-contain p-0.5" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">
            <Link href={`/s/${slug}/product/${p.id}`} className="hover:underline">
              {p.name}
            </Link>
          </h3>
          {eff !== null && (
            <div data-el="price" className="flex shrink-0 flex-col items-end">
              <span className="text-lg font-extrabold" style={{ color: brand }}>
                ₪{eff.toLocaleString("he-IL")}
              </span>
              {onSale && (
                <span className="text-xs text-zinc-400 line-through">
                  ₪{p.price!.toLocaleString("he-IL")}
                </span>
              )}
            </div>
          )}
        </div>
        {p.brand && (
          <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{p.brand}</div>
        )}
        {(p.category || p.subcategory) && (
          <div className="text-xs text-zinc-500">
            {[p.category, p.subcategory].filter(Boolean).join(" · ")}
          </div>
        )}
        {p.description && (
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-600">{p.description}</p>
        )}
        <div className="mt-4">
          <AddToCartButton
            productId={p.id}
            name={p.name}
            brand={brand}
            unitPrice={eff}
            image={gallery[0] ?? null}
            sizes={p.sizes}
            colors={p.colors}
            inStock={p.in_stock}
            slug={slug}
            regularPrice={p.price}
            salePrice={p.sale_price}
            variants={variants ?? null}
            preorder={p.preorder}
            engraving={p.engraving}
            catalogOnly={catalogOnly}
          />
        </div>
      </div>
    </div>
  );
}

export function PublicStore({
  products,
  brand,
  slug,
  sizeGuide,
  variantsByProduct = {},
  catalogOnly = false,
}: {
  products: Product[];
  brand: string;
  slug: string;
  sizeGuide?: unknown;
  variantsByProduct?: Record<string, ProductVariant[]>;
  /** Shop window: the shelf renders, nothing can be added to a cart. */
  catalogOnly?: boolean;
}) {
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))],
    [products],
  );
  // Facets derived from the catalog.
  const allSizes = useMemo(
    () => [...new Set(products.flatMap((p) => p.sizes ?? []))],
    [products],
  );
  const allBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter((b): b is string => Boolean(b)))],
    [products],
  );
  const allColors = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => p.colors?.forEach((c) => { if (!m.has(c.hex)) m.set(c.hex, c.name); }));
    return [...m.entries()].map(([hex, name]) => ({ hex, name }));
  }, [products]);
  const priceBounds = useMemo(() => {
    const prices = products.map(effectivePrice).filter((n): n is number => n != null);
    return { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
  }, [products]);

  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"default" | "price-asc" | "price-desc" | "newest" | "sale-first">("default");
  const [selSizes, setSelSizes] = useState<Set<string>>(new Set());
  const [selColors, setSelColors] = useState<Set<string>>(new Set());
  const [selBrands, setSelBrands] = useState<Set<string>>(new Set());
  const [priceMax, setPriceMax] = useState(priceBounds.max);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const priceActive = priceBounds.max > 0 && priceMax < priceBounds.max;
  const activeCount =
    (selSizes.size > 0 ? 1 : 0) + (selColors.size > 0 ? 1 : 0) + (selBrands.size > 0 ? 1 : 0) +
    (priceActive ? 1 : 0) + (onSaleOnly ? 1 : 0) + (inStockOnly ? 1 : 0);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }
  function clearAll() {
    setSelSizes(new Set());
    setSelColors(new Set());
    setSelBrands(new Set());
    setPriceMax(priceBounds.max);
    setOnSaleOnly(false);
    setInStockOnly(false);
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (filter && p.category !== filter) return false;
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        (p.category?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
      )) return false;
      if (selSizes.size && !(p.sizes?.some((s) => selSizes.has(s)))) return false;
      if (selColors.size && !(p.colors?.some((c) => selColors.has(c.hex)))) return false;
      if (selBrands.size && !(p.brand && selBrands.has(p.brand))) return false;
      const ep = effectivePrice(p);
      if (priceActive && ep != null && ep > priceMax) return false;
      if (onSaleOnly && !(p.sale_price != null && p.price != null && p.sale_price < p.price)) return false;
      if (inStockOnly && !p.in_stock) return false;
      return true;
    });
    if (sort === "price-asc" || sort === "price-desc") {
      list = [...list].sort((a, b) => {
        const pa = effectivePrice(a) ?? Infinity;
        const pb = effectivePrice(b) ?? Infinity;
        return sort === "price-asc" ? pa - pb : pb - pa;
      });
    } else if (sort === "newest") {
      list = [...list].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    } else if (sort === "sale-first") {
      list = [...list].sort((a, b) => {
        const sa = discountPct(a) ?? -1;
        const sb = discountPct(b) ?? -1;
        return sb - sa;
      });
    }
    return list;
  }, [products, filter, query, sort, selSizes, selColors, selBrands, priceMax, priceActive, onSaleOnly, inStockOnly]);

  return (
    <section id="store" data-el="module-section" className="mx-auto max-w-5xl px-4 py-16">
      <div data-reveal className="mb-8 flex flex-col items-center gap-3 text-center">
        <h2 data-el="section-title" className="flex items-center justify-center gap-2 text-3xl font-bold">
          <ShoppingBag className="size-7" style={{ color: brand }} />
          החנות שלנו
        </h2>
        <SizeGuide guide={sizeGuide} brand={brand} />
        <p className="text-xs text-zinc-400">כל המחירים כוללים מע״מ</p>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="rounded-full border px-4 py-1.5 text-sm font-medium transition"
            style={
              filter === null
                ? { backgroundColor: brand, color: inkOn(brand), borderColor: brand }
                : { borderColor: CHIP_HAIRLINE }
            }
          >
            הכל
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className="rounded-full border px-4 py-1.5 text-sm font-medium transition"
              style={
                filter === c
                  ? { backgroundColor: brand, color: inkOn(brand), borderColor: brand }
                  : { borderColor: CHIP_HAIRLINE }
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Search + sort */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מוצר..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pe-9 ps-3 text-sm outline-none focus:border-zinc-400"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
        >
          <option value="default">מומלץ</option>
          <option value="price-asc">מחיר: מהנמוך לגבוה</option>
          <option value="price-desc">מחיר: מהגבוה לנמוך</option>
          <option value="newest">חדש ביותר</option>
          <option value="sale-first">מבצעים תחילה</option>
        </select>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2.5 text-sm font-medium"
          style={activeCount > 0 ? { borderColor: brand, color: brand } : { borderColor: CHIP_HAIRLINE }}
        >
          <SlidersHorizontal className="size-4" />
          סינון
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full text-[11px] text-white" style={{ backgroundColor: brand, color: inkOn(brand) }}>
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="mx-auto mb-6 max-w-2xl space-y-4 rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">סינון מתקדם</span>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <button type="button" onClick={clearAll} className="text-xs text-zinc-500 underline-offset-2 hover:underline">
                  נקה הכל
                </button>
              )}
              <button type="button" aria-label="סגירה" onClick={() => setShowFilters(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Price */}
          {priceBounds.max > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">מחיר עד</span>
                <span className="font-semibold" style={{ color: brand }}>₪{priceMax.toLocaleString("he-IL")}</span>
              </div>
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                value={priceMax}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: brand }}
              />
            </div>
          )}

          {/* Sizes */}
          {allSizes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-sm text-zinc-600">מידה</span>
              <div className="flex flex-wrap gap-1.5">
                {allSizes.map((s) => {
                  const on = selSizes.has(s);
                  return (
                    <button key={s} type="button" onClick={() => toggle(selSizes, setSelSizes, s)}
                      className="min-w-9 rounded-lg border px-2.5 py-1 text-sm font-medium"
                      style={on ? { borderColor: brand, color: brand, backgroundColor: `${brand}10` } : { borderColor: CHIP_HAIRLINE }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Brands */}
          {allBrands.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-sm text-zinc-600">מותג</span>
              <div className="flex flex-wrap gap-1.5">
                {allBrands.map((b) => {
                  const on = selBrands.has(b);
                  return (
                    <button key={b} type="button" onClick={() => toggle(selBrands, setSelBrands, b)}
                      className="rounded-lg border px-2.5 py-1 text-sm font-medium"
                      style={on ? { borderColor: brand, color: brand, backgroundColor: `${brand}10` } : { borderColor: CHIP_HAIRLINE }}>
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Colors */}
          {allColors.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-sm text-zinc-600">צבע</span>
              <div className="flex flex-wrap gap-2">
                {allColors.map((c) => {
                  const on = selColors.has(c.hex);
                  return (
                    <button key={c.hex} type="button" title={c.name} onClick={() => toggle(selColors, setSelColors, c.hex)}
                      className="flex size-8 items-center justify-center rounded-full border-2"
                      style={{ borderColor: on ? brand : CHIP_HAIRLINE, backgroundColor: c.hex }}>
                      {on && <Check className="size-4" style={{ color: c.hex === "#FFFFFF" ? "#000" : "#fff" }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={onSaleOnly} onChange={(e) => setOnSaleOnly(e.target.checked)} className="size-4" style={{ accentColor: brand }} />
              במבצע בלבד
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-4" style={{ accentColor: brand }} />
              במלאי בלבד
            </label>
          </div>
        </div>
      )}

      <div className="mb-4 text-center text-sm text-zinc-500">{shown.length} מוצרים</div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-zinc-500">
          <Package className="size-10 opacity-40" />
          <p>לא נמצאו מוצרים תואמים</p>
          {/* A dead end with no way back out of the filters is how a shopper
              concludes the store is empty. */}
          <button
            type="button"
            onClick={() => {
              clearAll();
              setQuery("");
              setFilter(null);
            }}
            className="rounded-full border px-4 py-1.5 text-sm font-medium"
            style={{ borderColor: brand, color: brand }}
          >
            ניקוי כל הסינונים
          </button>
        </div>
      ) : (
        <div data-el="product-grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            // h-full: the grid stretches this wrapper to the row height, but the
            // card inside was content-height, so "add to cart" sat at a
            // different y on every card in the row.
            <div key={p.id} data-reveal className="h-full">
              <ProductCard p={p} brand={brand} slug={slug} variants={variantsByProduct[p.id]} catalogOnly={catalogOnly} />
            </div>
          ))}
        </div>
      )}

      <RecentlyViewed slug={slug} brand={brand} />
    </section>
  );
}
