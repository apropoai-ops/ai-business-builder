import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Truck, ShieldCheck, RefreshCcw } from "lucide-react";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { safeJsonLd } from "@/lib/utils";
import { getPublicProductById } from "@/lib/services/store.service";
import { brandForGround, inkOn, storeBranding } from "@/lib/storefront-brand";
import { resolveSiteTheme } from "@/lib/site-theme";
import { TierStyles } from "@/components/public/tiers/tier-styles";
import { parseEnabledMethods } from "@/lib/payments";
import { storeCardEnabledBySlug } from "@/lib/services/store-checkout.service";
import { CartProvider } from "@/components/public/cart-context";
import { CartDrawer, type CheckoutPayment } from "@/components/public/cart-drawer";
import { CheckoutResult } from "@/components/public/checkout-result";
import { AddToCartButton } from "@/components/public/add-to-cart-button";
import { ProductGallery } from "@/components/public/product-gallery";
import { ProductAccordions } from "@/components/public/product-accordions";
import { RelatedProducts } from "@/components/public/related-products";
import { SiteVisitTracker } from "@/components/public/site-visit-tracker";
import type { Product, ProductVariant } from "@/types/database";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

function effectivePrice(p: Product): number | null {
  if (p.sale_price != null && p.price != null && Number(p.sale_price) < Number(p.price)) {
    return Number(p.sale_price);
  }
  return p.price != null ? Number(p.price) : null;
}

/** Discount percentage (rounded) when the product has a real sale price, else null. */
function discountPct(p: Product): number | null {
  if (p.sale_price == null || p.price == null) return null;
  const price = Number(p.price);
  const sale = Number(p.sale_price);
  if (sale >= price || price <= 0) return null;
  return Math.round((1 - sale / price) * 100);
}

const NEW_WINDOW_DAYS = 30;

/** True when the product was created within the last {@link NEW_WINDOW_DAYS} days. */
function isNew(p: Product): boolean {
  if (!p.created_at) return false;
  const created = new Date(p.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function galleryOf(p: Product): string[] {
  const imgs = [p.image_url, ...((p.images as string[] | null) ?? [])].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  return [...new Set(imgs)];
}

async function load(slug: string, productId: string) {
  const site = await getPublicSiteBySlug(slug);
  if (!site) return null;
  let product = site.products.find((p) => p.id === productId) ?? null;
  let variants: ProductVariant[] = site.variantsByProduct[productId] ?? [];
  if (!product) {
    const fetched = await getPublicProductById(site.website.business_id, productId);
    if (!fetched) return null;
    product = fetched.product;
    variants = fetched.variants;
  }
  return { site, product, variants };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  const data = await load(slug, productId);
  if (!data) return { title: "מוצר לא נמצא" };
  const { product } = data;
  const title = `${product.name} | ${storeBranding(data.site).brandName}`;
  const description = product.description ?? undefined;
  const image = product.image_url ?? (product.images as string[] | null)?.[0] ?? null;
  const canonical = `${BASE_URL}/s/${slug}/product/${productId}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "he_IL",
      ...(image ? { images: [{ url: image, width: 1200, height: 1200 }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const data = await load(slug, productId);
  if (!data) notFound();

  const { site, product, variants } = data;
  const { brandName, brand: rawBrand, logoUrl } = storeBranding(site);
  // Lifted (or darkened) for THIS site's colour scheme before anything paints
  // with it — see lib/site-theme.ts.
  const theme = resolveSiteTheme(site.website.theme);
  const brand = brandForGround(rawBrand, theme.inkMeasure);
  const tier = site.designTier;
  const eff = effectivePrice(product);
  const onSale = eff != null && product.price != null && eff < Number(product.price);
  const pct = discountPct(product);
  const fresh = isNew(product);
  const images = galleryOf(product);
  const lowStock =
    product.stock_qty != null &&
    product.low_stock_threshold != null &&
    product.stock_qty > 0 &&
    product.stock_qty <= product.low_stock_threshold;

  const payment: CheckoutPayment = {
    methods: parseEnabledMethods(site.business.payment_methods),
    bank: (site.business.bank_details as CheckoutPayment["bank"]) ?? null,
    bitPhone: site.business.bit_phone,
    paypalLink: site.business.paypal_link,
    cardLink: site.business.payment_link,
    stripeCard: await storeCardEnabledBySlug(slug),
  };

  // Shop window (see lib/site-mode.ts): the product page still renders in full,
  // but there is no cart in the header and no way to add this to one.
  const catalogOnly = site.business.catalog_only === true;

  const outOfStock =
    product.in_stock === false || (product.stock_qty != null && product.stock_qty <= 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(eff != null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "ILS",
            price: eff,
            availability: catalogOnly
              ? "https://schema.org/InStoreOnly"
              : outOfStock
                ? "https://schema.org/OutOfStock"
                : "https://schema.org/InStock",
            url: `${BASE_URL}/s/${slug}/product/${productId}`,
          },
        }
      : {}),
  };

  return (
    <CartProvider slug={slug}>
      <div data-tier={tier} className="min-h-screen bg-zinc-50 text-zinc-900">
        <TierStyles tier={tier} brand={brand} theme={theme.key} heroStyle={site.website.hero_style} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
        <SiteVisitTracker slug={slug} path={`/product/${productId}`} />
        {/* Header */}
        <header data-el="chrome-header" className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
            <Link href={`/s/${slug}`} className="flex items-center gap-2 font-bold" style={{ color: brand }}>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-9 w-auto max-w-[168px] shrink-0 rounded-md bg-white/90 object-contain p-1"
                />
              )}
              <span className="truncate">{brandName}</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/s/${slug}#store`}
                className="hidden items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-white sm:flex"
              >
                <ArrowRight className="size-4" />
                חזרה לחנות
              </Link>
              {!catalogOnly && (
                <CartDrawer
                  slug={slug}
                  brand={brand}
                  shippingFee={site.business.shipping_fee}
                  freeThreshold={site.business.free_shipping_threshold}
                  payment={payment}
                  shippingMethods={site.shippingMethods}
                  products={site.products}
                />
              )}
            </div>
          </div>
        </header>

        <CheckoutResult brand={brand} />

        <main data-el="module-section" className="mx-auto max-w-5xl px-4 py-8">
          {/* Breadcrumb */}
          <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
            <Link href={`/s/${slug}`} className="transition-colors hover:text-white">בית</Link>
            <span>/</span>
            <Link href={`/s/${slug}#store`} className="transition-colors hover:text-white">חנות</Link>
            {product.category && (
              <>
                <span>/</span>
                <span className="text-zinc-700">{product.category}</span>
              </>
            )}
          </nav>

          <div className="grid gap-8 md:grid-cols-2">
            <ProductGallery images={images} alt={product.name} brand={brand} />

            <div className="flex flex-col">
              {product.brand && (
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {product.brand}
                </div>
              )}
              <h1 data-el="section-title" className="mt-1 text-2xl font-bold sm:text-3xl">{product.name}</h1>
              {(product.category || product.subcategory) && (
                <div className="mt-1 text-sm text-zinc-500">
                  {[product.category, product.subcategory].filter(Boolean).join(" · ")}
                </div>
              )}

              {/* Badges */}
              {(onSale || fresh) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
              )}

              {/* Price */}
              {eff != null && (
                <div data-el="price" className="mt-4 flex items-end gap-3">
                  <span className="text-3xl font-extrabold" style={{ color: brand }}>
                    ₪{eff.toLocaleString("he-IL")}
                  </span>
                  {onSale && (
                    <span className="pb-1 text-lg text-zinc-400 line-through">
                      ₪{Number(product.price).toLocaleString("he-IL")}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-1 text-xs text-zinc-400">המחיר כולל מע״מ</div>

              {/* Stock hint */}
              {product.in_stock === false ? (
                <div className="mt-3 inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-500">
                  אזל מהמלאי
                </div>
              ) : lowStock ? (
                <div className="mt-3 inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700">
                  כמות אחרונה במלאי
                </div>
              ) : null}

              {/* Short description teaser (full text lives in the accordion below) */}
              {product.description && (
                <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-700">
                  {product.description}
                </p>
              )}

              {/* Accordions: full description, shipping/returns, size guide */}
              <ProductAccordions
                description={product.full_description}
                shippingMethods={site.shippingMethods}
                sizeGuide={site.business.size_guide}
                brand={brand}
                slug={slug}
              />

              {/* Add to cart + variant pickers */}
              <div className="mt-6">
                <AddToCartButton
                  productId={product.id}
                  name={product.name}
                  brand={brand}
                  unitPrice={eff}
                  image={images[0] ?? null}
                  sizes={product.sizes}
                  colors={product.colors}
                  inStock={product.in_stock}
                  slug={slug}
                  regularPrice={product.price}
                  salePrice={product.sale_price}
                  variants={variants.length > 0 ? variants : null}
                  preorder={product.preorder}
                  engraving={product.engraving}
                  catalogOnly={catalogOnly}
                />
              </div>

              {/* Trust badges */}
              <div className="mt-6 grid grid-cols-3 gap-3 border-t pt-5 text-center text-xs text-zinc-600">
                <div className="flex flex-col items-center gap-1">
                  <Truck className="size-5" style={{ color: brand }} />
                  משלוח עד הבית
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck className="size-5" style={{ color: brand }} />
                  תשלום מאובטח
                </div>
                <div className="flex flex-col items-center gap-1">
                  <RefreshCcw className="size-5" style={{ color: brand }} />
                  החזרות והחלפות
                </div>
              </div>

              {/* Tags */}
              {(product.tags as string[] | null)?.length ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {(product.tags as string[]).map((t) => (
                    <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <RelatedProducts
            products={site.products}
            currentId={product.id}
            category={product.category}
            brand={brand}
            slug={slug}
          />
        </main>
      </div>
    </CartProvider>
  );
}
