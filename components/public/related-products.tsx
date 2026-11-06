/**
 * "אולי יעניין אתכם" strip on the product page — up to 4 other products,
 * same category first then filled with others. Reuses the site's already
 * fetched product list (no extra data fetching).
 */
import Link from "next/link";
import { Package } from "lucide-react";

import type { Product } from "@/types/database";

function effectivePrice(p: Product): number | null {
  if (p.sale_price != null && p.price != null && p.sale_price < p.price) return p.sale_price;
  return p.price;
}

export function RelatedProducts({
  products,
  currentId,
  category,
  brand,
  slug,
}: {
  products: Product[];
  currentId: string;
  category: string | null;
  brand: string;
  slug: string;
}) {
  const pool = products.filter((p) => p.id !== currentId);
  const sameCategory = category ? pool.filter((p) => p.category === category) : [];
  const rest = pool.filter((p) => !sameCategory.includes(p));
  const related = [...sameCategory, ...rest].slice(0, 4);

  if (related.length === 0) return null;

  return (
    <section className="mx-auto mt-14 max-w-6xl px-4">
      <h2 className="mb-5 text-xl font-bold">אולי יעניין אתכם</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {related.map((p) => {
          const eff = effectivePrice(p);
          const onSale = p.sale_price != null && p.price != null && p.sale_price < p.price;
          const img = p.images?.[0] ?? p.image_url ?? null;
          return (
            <Link
              key={p.id}
              href={`/s/${slug}/product/${p.id}`}
              className="svc-card flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={p.name}
                  loading="lazy"
                  className="h-36 w-full bg-white object-contain p-2"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center" style={{ background: `${brand}10` }}>
                  <Package className="size-8" style={{ color: brand }} />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className="line-clamp-2 text-sm font-bold">{p.name}</span>
                {eff !== null && (
                  <div className="mt-auto flex items-baseline gap-1.5">
                    <span className="text-sm font-extrabold" style={{ color: brand }}>
                      ₪{eff.toLocaleString()}
                    </span>
                    {onSale && (
                      <span className="text-xs text-zinc-400 line-through">₪{p.price!.toLocaleString()}</span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
