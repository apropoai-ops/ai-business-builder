-- ============================================================================
--  Migration 0062 — blog posts: updated_at + unique slug per business.
--  blog_posts already has a `slug` column (from 0046) but it was never
--  populated/enforced. This adds updated_at (for accurate sitemap lastmod +
--  "last edited" in the manager) and a per-business uniqueness constraint on
--  slug so public post URLs (/s/[slug]/blog/[postSlug]) are unambiguous.
-- ============================================================================

alter table public.blog_posts
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- One slug per business (nulls allowed/ignored — legacy posts without a slug
-- fall back to id-based lookup in the app layer).
create unique index if not exists blog_posts_business_slug_key
  on public.blog_posts (business_id, slug)
  where slug is not null;

create index if not exists blog_posts_business_published_idx
  on public.blog_posts (business_id, published, published_at desc);
