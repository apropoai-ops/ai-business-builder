/**
 * Public blog/articles section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <BlogSection businessId={businessId} slug={slug} brand={brand} />
 *
 * (async server component — service-role fetches the business's published posts;
 * renders nothing when there are none.) Cards link through to the full post at
 * /s/[slug]/blog/[postId]; a "כל המאמרים" link appears when there are more than 6.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listPublicBlog, listPublicBlogAll } from "@/lib/services/blog.service";

export async function BlogSection({
  businessId,
  slug,
  brand,
}: {
  businessId: string;
  slug: string;
  brand: string;
}) {
  const [posts, all] = await Promise.all([
    listPublicBlog(businessId),
    listPublicBlogAll(businessId),
  ]);
  if (posts.length === 0) return null;

  return (
    <section id="blog" data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <h2 className="text-3xl font-bold">מהבלוג</h2>
          {all.length > posts.length && (
            <Link
              href={`/s/${slug}/blog`}
              className="flex items-center gap-1 text-sm font-semibold hover:underline"
              style={{ color: brand }}
            >
              כל המאמרים
              <ArrowLeft className="size-4" />
            </Link>
          )}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/s/${slug}/blog/${p.slug ?? p.id}`}
              className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
            >
              {p.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.cover_url}
                  alt={p.title}
                  loading="lazy"
                  className="h-44 w-full object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <div
                  className="h-44 w-full"
                  style={{ backgroundColor: `${brand}1a` }}
                />
              )}
              <div className="p-5">
                <h3 className="font-bold leading-snug group-hover:underline">{p.title}</h3>
                {p.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-600">
                    {p.excerpt}
                  </p>
                )}
                {p.published_at && (
                  <p className="mt-3 text-xs text-zinc-500">
                    {new Date(p.published_at).toLocaleDateString("he-IL")}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
