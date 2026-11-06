-- 0084 — let a user create their OWN profile row, with the same column
-- restriction 0083 put on UPDATE.
--
-- NO GIT IN THIS REPO. Down-path at the bottom.
--
-- ── The bug (pre-existing, found while verifying 0083) ──────────────────────
-- public.profiles had exactly two policies: profiles_select_own (r) and
-- profiles_update_own (w). No INSERT policy at all, and RLS is default-deny.
--
-- updateProfileName (lib/auth/actions.ts:269-271) issues
--   .upsert({ id, full_name }, { onConflict: "id" })
-- which is INSERT ... ON CONFLICT DO UPDATE. PostgreSQL applies the INSERT
-- WITH CHECK policy to the proposed row BEFORE the conflict path is taken, so
-- with no INSERT policy the statement is refused outright — even when the row
-- already exists and only the DO UPDATE branch would ever run.
--
-- Proven as role `authenticated` with a JWT claim, in a rolled-back
-- transaction:
--   plain UPDATE full_name .......... OK
--   the upsert the app issues ....... new row violates row-level security
--                                     policy for table "profiles"
--
-- So "שמירת שם" has been returning "השמירה נכשלה" for every user. The upsert's
-- own comment says it exists for "users created before the profiles trigger" —
-- that path could never have worked either.
--
-- ── The fix ────────────────────────────────────────────────────────────────
-- An INSERT policy alone would REOPEN what 0083 just closed: the table-level
-- grant still carries `a` (INSERT), so a client could POST
-- {"id":<own uid>,"full_name":"x","plan":"business"} and land a business-tier
-- row on the pure-insert path. The column grant is narrowed to match 0083's
-- UPDATE list first, so `plan` is unreachable on BOTH paths.
--
-- On the conflict path the DO UPDATE SET list is derived from the payload keys,
-- so a payload carrying `plan` is refused by 0083's column grant with 42501.
-- On the pure-insert path it is refused by the INSERT column grant below.
-- ────────────────────────────────────────────────────────────────────────────

revoke insert on public.profiles from anon, authenticated;
grant  insert (id, full_name, avatar_url, phone) on public.profiles to authenticated;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));


-- ── Down ────────────────────────────────────────────────────────────────────
--   drop policy if exists profiles_insert_own on public.profiles;
--   grant insert on public.profiles to anon, authenticated;
--
-- Note the down-path restores the ORIGINAL (broken) behaviour: name saving
-- fails again. Only revert this together with 0083.
