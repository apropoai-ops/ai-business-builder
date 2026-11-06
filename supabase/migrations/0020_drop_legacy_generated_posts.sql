-- 0020 drop legacy generated_posts
-- Legacy table from an early iteration, never referenced by current source code.
-- Source of 4 of 5 performance advisor findings (unindexed FK + 2 RLS initplan policies).
drop table if exists public.generated_posts;
