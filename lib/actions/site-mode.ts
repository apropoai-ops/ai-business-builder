// REMOVED in 0085 — this file intentionally exports nothing.
//
// setSiteModeAction used to let a business switch between the three products by
// writing businesses.site_mode on the user-scoped client. Since 0085 that write
// is rejected by trg_guard_site_mode (42501): site_mode is the package the
// customer bought, so it is set once at wizard time (lib/actions/business.ts,
// an INSERT, deliberately unguarded) and afterwards only by the operator, via
// the SECURITY DEFINER admin_set_site_mode(uuid,text,text) — upgrade-only and
// audited. See docs/admin/SPEC.md §1b.
//
// It had zero call sites when it was removed. Do not reintroduce a client-side
// mode switcher: two definitions of "change the mode", one of which bypasses
// the paywall, is the exact trap this closes. Upgrades go through the console.
export {};
