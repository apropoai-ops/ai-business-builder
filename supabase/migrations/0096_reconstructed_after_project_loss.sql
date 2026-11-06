-- 0096: reconstruction after an accidental Supabase project deletion
-- (2026-08-26). The project referenced by NEXT_PUBLIC_SUPABASE_URL
-- (vxkamrcukzdovfikzeyt) was deleted; a new project was created
-- (hnoiqqpypyoporughmza) and every migration 0001-0095 was replayed against
-- it. Two gaps surfaced during that replay that predate this incident and
-- were never captured as migration files — both are closed here so the
-- migrations folder is finally a complete, replayable source of truth.
--
-- GAP 1 — 20 "universal module" tables (before_after, blog_posts, branches,
-- certifications, courses, donations, downloads, events, faqs, gallery_items,
-- gift_cards, job_openings, memberships, menu_items, partners, pricing_plans,
-- process_steps, stats, team_members, testimonials) were created directly via
-- MCP for 0046/0047 ("universal_modules", "universal_modules_2") and never
-- saved as SQL — those two migration files are comment-only stubs. Reconstructed
-- here from types/database.ts (generated from the live schema before deletion).
--
-- GAP 2 — products, bookings and booking_settings (created in 0012) NEVER had
-- row level security enabled at all. This is a real, pre-existing security gap
-- (Supabase's own security advisor flags "RLS Disabled in Public" as ERROR),
-- not something introduced by the recovery — it was silently open on the
-- original project too. Closed with the same is_business_owner(business_id)
-- policy pattern used by every other feature table.

-- ══ Gap 1: universal module tables ══════════════════════════════════════════

create table if not exists public.before_after (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text,
  before_url text not null,
  after_url text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.before_after enable row level security;
drop policy if exists "before_after_owner_all" on public.before_after;
create policy "before_after_owner_all" on public.before_after
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_before_after_business on public.before_after (business_id, sort);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  slug text,
  excerpt text,
  body text,
  cover_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.blog_posts enable row level security;
drop policy if exists "blog_posts_owner_all" on public.blog_posts;
create policy "blog_posts_owner_all" on public.blog_posts
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_blog_posts_business on public.blog_posts (business_id, published, published_at desc);
drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();
create unique index if not exists blog_posts_business_slug_key
  on public.blog_posts (business_id, slug)
  where slug is not null;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  hours text,
  map_url text,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.branches enable row level security;
drop policy if exists "branches_owner_all" on public.branches;
create policy "branches_owner_all" on public.branches
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_branches_business on public.branches (business_id, sort);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  issuer text,
  year text,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.certifications enable row level security;
drop policy if exists "certifications_owner_all" on public.certifications;
create policy "certifications_owner_all" on public.certifications
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_certifications_business on public.certifications (business_id, sort);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  duration text,
  level text,
  price numeric,
  image_url text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.courses enable row level security;
drop policy if exists "courses_owner_all" on public.courses;
create policy "courses_owner_all" on public.courses
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_courses_business on public.courses (business_id, sort);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  goal_amount numeric,
  raised_amount numeric not null default 0,
  image_url text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.donations enable row level security;
drop policy if exists "donations_owner_all" on public.donations;
create policy "donations_owner_all" on public.donations
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_donations_business on public.donations (business_id, sort);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  file_url text,
  storage_path text,
  price numeric,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.downloads enable row level security;
drop policy if exists "downloads_owner_all" on public.downloads;
create policy "downloads_owner_all" on public.downloads
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_downloads_business on public.downloads (business_id, sort);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz,
  location text,
  capacity int,
  image_url text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists "events_owner_all" on public.events;
create policy "events_owner_all" on public.events
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_events_business on public.events (business_id, sort);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  question text not null,
  answer text,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.faqs enable row level security;
drop policy if exists "faqs_owner_all" on public.faqs;
create policy "faqs_owner_all" on public.faqs
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_faqs_business on public.faqs (business_id, sort);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  image_url text not null,
  caption text,
  title text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.gallery_items enable row level security;
drop policy if exists "gallery_items_owner_all" on public.gallery_items;
create policy "gallery_items_owner_all" on public.gallery_items
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_gallery_items_business on public.gallery_items (business_id, sort);

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  initial_amount numeric not null,
  balance numeric not null,
  recipient_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (business_id, code)
);
alter table public.gift_cards enable row level security;
drop policy if exists "gift_cards_owner_all" on public.gift_cards;
create policy "gift_cards_owner_all" on public.gift_cards
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_gift_cards_business on public.gift_cards (business_id);

create table if not exists public.job_openings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  location text,
  employment_type text,
  image_url text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.job_openings enable row level security;
drop policy if exists "job_openings_owner_all" on public.job_openings;
create policy "job_openings_owner_all" on public.job_openings
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_job_openings_business on public.job_openings (business_id, sort);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  price numeric,
  period text,
  perks jsonb,
  highlight boolean not null default false,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
drop policy if exists "memberships_owner_all" on public.memberships;
create policy "memberships_owner_all" on public.memberships
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_memberships_business on public.memberships (business_id, sort);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price numeric,
  section text,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.menu_items enable row level security;
drop policy if exists "menu_items_owner_all" on public.menu_items;
create policy "menu_items_owner_all" on public.menu_items
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_menu_items_business on public.menu_items (business_id, sort);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  logo_url text,
  link text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
drop policy if exists "partners_owner_all" on public.partners;
create policy "partners_owner_all" on public.partners
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_partners_business on public.partners (business_id, sort);

create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  price numeric,
  period text,
  features jsonb,
  highlight boolean not null default false,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.pricing_plans enable row level security;
drop policy if exists "pricing_plans_owner_all" on public.pricing_plans;
create policy "pricing_plans_owner_all" on public.pricing_plans
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_pricing_plans_business on public.pricing_plans (business_id, sort);

create table if not exists public.process_steps (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.process_steps enable row level security;
drop policy if exists "process_steps_owner_all" on public.process_steps;
create policy "process_steps_owner_all" on public.process_steps
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_process_steps_business on public.process_steps (business_id, sort);

create table if not exists public.stats (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null,
  value text not null,
  suffix text,
  image_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.stats enable row level security;
drop policy if exists "stats_owner_all" on public.stats;
create policy "stats_owner_all" on public.stats
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_stats_business on public.stats (business_id, sort);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  role text,
  bio text,
  photo_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;
drop policy if exists "team_members_owner_all" on public.team_members;
create policy "team_members_owner_all" on public.team_members
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_team_members_business on public.team_members (business_id, sort);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author text not null,
  role text,
  quote text not null,
  rating int,
  photo_url text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.testimonials enable row level security;
drop policy if exists "testimonials_owner_all" on public.testimonials;
create policy "testimonials_owner_all" on public.testimonials
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
create index if not exists idx_testimonials_business on public.testimonials (business_id, sort);

-- ══ Gap 2: products / bookings / booking_settings had no RLS at all ═════════

alter table public.products enable row level security;
drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all" on public.products
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

alter table public.booking_settings enable row level security;
drop policy if exists "booking_settings_owner_all" on public.booking_settings;
create policy "booking_settings_owner_all" on public.booking_settings
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

alter table public.bookings enable row level security;
drop policy if exists "bookings_owner_all" on public.bookings;
create policy "bookings_owner_all" on public.bookings
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
drop policy if exists "bookings_customer_select" on public.bookings;
create policy "bookings_customer_select" on public.bookings
  for select using (customer_user_id = auth.uid());
