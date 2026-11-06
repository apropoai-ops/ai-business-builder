import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/types/database";

// ── Slugs ────────────────────────────────────────────────────────────────

/** URL-safe slug from a (possibly Hebrew) title — keeps letters/digits, dashes. */
function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base.slice(0, 80) || "post";
}

/** Appends -2, -3, ... until the slug is free within the business (excluding `excludeId`). */
async function uniqueSlug(
  businessId: string,
  title: string,
  excludeId?: string,
): Promise<string> {
  const supabase = await createClient();
  const base = slugify(title);
  let candidate = base;
  let n = 2;
  // Small, bounded loop — blog volumes per business are never large.
  for (let i = 0; i < 50; i++) {
    let query = supabase
      .from("blog_posts")
      .select("id")
      .eq("business_id", businessId)
      .eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${n++}`;
  }
  return `${base}-${Date.now()}`;
}

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All posts for the business dashboard, newest first. */
export async function listBlog(businessId: string): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBlogPost(
  businessId: string,
  fields: {
    title: string;
    excerpt: string | null;
    body: string | null;
    cover_url: string | null;
    published: boolean;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const slug = await uniqueSlug(businessId, fields.title);
  // When a post is published with no explicit date, stamp it now so it sorts
  // and displays correctly on the public site.
  const published_at = fields.published ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("blog_posts")
    .insert({ business_id: businessId, ...fields, slug, published_at });
  if (error) return { error: error.message };
  return {};
}

export async function updateBlogPost(
  businessId: string,
  id: string,
  fields: {
    title: string;
    excerpt: string | null;
    body: string | null;
    cover_url: string | null;
    published: boolean;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("blog_posts")
    .select("title, slug, published, published_at")
    .eq("id", id)
    .maybeSingle();

  // Re-slug only if the title actually changed (keeps existing shared links stable).
  const slug =
    existing && existing.title === fields.title && existing.slug
      ? existing.slug
      : await uniqueSlug(businessId, fields.title, id);

  // Stamp published_at the first time a post goes live; leave it once set.
  const published_at =
    fields.published && !existing?.published_at
      ? new Date().toISOString()
      : (existing?.published_at ?? null);

  const { error } = await supabase
    .from("blog_posts")
    .update({ ...fields, slug, published_at })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteBlogPost(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setBlogPublished(id: string, published: boolean): Promise<void> {
  const supabase = await createClient();
  // Stamp published_at the first time a post goes live; leave it once set.
  const patch: { published: boolean; published_at?: string } = { published };
  if (published) patch.published_at = new Date().toISOString();
  const { error } = await supabase.from("blog_posts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Published posts for the public site homepage teaser — newest first, capped at 6. */
export async function listPublicBlog(businessId: string): Promise<BlogPost[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(6);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** All published posts for the /s/[slug]/blog index — newest first, bounded. */
export async function listPublicBlogAll(businessId: string): Promise<BlogPost[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A single published post by slug (preferred) or id — for the public post page. */
export async function getPublicBlogPost(
  businessId: string,
  idOrSlug: string,
): Promise<BlogPost | null> {
  const s = createServiceRoleClient();

  // Two plain .eq() lookups instead of a hand-built .or() filter string —
  // the route param is attacker-controlled and could contain characters
  // (commas, parens) that would break PostgREST's or() filter syntax.
  const { data: bySlug, error: slugError } = await s
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .eq("published", true)
    .eq("slug", idOrSlug)
    .limit(1)
    .maybeSingle();
  if (slugError) throw new Error(slugError.message);
  if (bySlug) return bySlug;

  // `id` is a uuid column — only try it when the param actually looks like one,
  // otherwise Postgres rejects the cast and throws.
  if (!UUID_RE.test(idOrSlug)) return null;
  const { data: byId, error: idError } = await s
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .eq("published", true)
    .eq("id", idOrSlug)
    .limit(1)
    .maybeSingle();
  if (idError) throw new Error(idError.message);
  return byId ?? null;
}

/** Bounded set of published posts (with their business_id) for the sitemap. */
export async function listPublicBlogForSitemap(
  businessIds: string[],
): Promise<Pick<BlogPost, "id" | "business_id" | "slug" | "published_at" | "created_at">[]> {
  if (businessIds.length === 0) return [];
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("blog_posts")
    .select("id, business_id, slug, published_at, created_at")
    .eq("published", true)
    .in("business_id", businessIds)
    .order("published_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}
