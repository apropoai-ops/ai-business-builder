# קונסולת מנהל הפלטפורמה — "מוקד"

> ‏המפרט ב-`SPEC.md` הופק ב-2026-08-04 ע"י ‏Workflow‏ של ‏13 סוכנים.
> ‏**אל תתכנן מחדש** — התוצר כאן.

## ‏מה יש כאן

| ‏קובץ | ‏תוכן |
|---|---|
| `SPEC.md` | ‏מפרט היישום המלא — גבול ההרשאות, SQL, 11 שלבי בנייה, מסכים, אימות |
| `adversarial-review.json` | ‏11 הממצאים הקריטיים/גבוהים שהמבקרים מצאו, עם התיקון לכל אחד |

## ‏סטטוס

| ‏שלב | ‏מצב |
|---|---|
| ‏1 — ‏`profiles` | ‏**הוחל ואומת** — ‏`0083_lock_profiles_plan.sql`‎ + ‏`0084_profiles_insert_policy.sql`‎ |
| ‏2 — ‏טריגרים ל-`site_mode`‎ ו-`published`‎ | ‏**הוחל ואומת ‏2026-08-04** — ‏`0085_lock_site_mode_and_publish.sql`‎ + דיפלוי הקוד |
| ‏3–11 | ‏פתוח. **כאן ממשיכים** — סעיף ‏3 במפרט (סכמת הקונסולה). |

## ‏שלב 2 — מה יצא בפועל

‏הקוד עלה **ראשון**, ורק אחריו הטריגר: הסדר ההפוך משאיר חלון שבו לקוחות
‏לא יכולים לפרסם, וכך החלון היחיד היה כתיבת service-role בלי טריגר — לא רגרסיה.

- ‏`trg_guard_site_mode` (‏`businesses`‎, before update)‎ ו-`trg_guard_publish`‎
  ‏(‏`websites`‎, before insert or update)‎ — שניהם דרך
  `public.assert_platform_controlled_write()`, שמתירה רק ‏`pg_has_role(current_user,'service_role','member')`‎.
- `revoke delete on public.websites from anon, authenticated` — סוגר את עקיפת ‏DELETE-then-INSERT.
- `revoke all on function public.is_business_owner_or_admin(uuid) from public, anon` —
  ‏השריד ש-0076 פספסה; ה-ACL זהה עכשיו ל-`is_business_owner`.
- ‏`setWebsitePublishState`‎ עבר ל-`createServiceRoleClient()`‎, ובעלות נבדקת בתוך
  ‏הפונקציה עצמה על לקוח ה-RLS‏ (קודם ‏RLS‏ הייתה הבדיקה היחידה).
- ‏`lib/actions/site-mode.ts`‎ רוקן ל-tombstone‏: ‏`setSiteModeAction`‎ כתב
  ‏`site_mode`‎ דרך לקוח ‏RLS‏, כלומר היה זורק מעכשיו — והוא היה בלי אף קורא.

## ‏חשבון המנהל

`ofek404040@gmail.com` = `9d1bba47-ad47-440f-a683-89db23360f27` — ‏ה-uuid שכבר מקודד ב-`lib/quota.ts`.
