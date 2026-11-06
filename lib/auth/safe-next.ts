/**
 * Only allow same-origin, absolute-path redirect targets after login (e.g.
 * /invite/<token>) — never an external URL. Defaults to the dashboard.
 *
 * Guards against a `next=@evil.com`-style open redirect: string-concatenating
 * an unvalidated `next` onto an origin (`${origin}${next}`) can resolve as
 * userinfo@host (e.g. `https://oursite.com@evil.com`) in some URL parsers,
 * sending an authenticated user off-site right after login.
 */
export function safeNext(next: string | null): string {
  // Backslashes are rejected too: browsers normalise `/\evil.com` to
  // `//evil.com` when it lands in a Location header. Control characters
  // (tab/CR/LF) are stripped by URL parsers and can hide the same trick.
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(next)
  ) {
    return next;
  }
  return "/businesses";
}
