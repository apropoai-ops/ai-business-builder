import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { NewsletterSignup } from "@/components/public/newsletter-signup";
import { platformDef, type SocialLink } from "@/lib/social-links";

/**
 * Full storefront footer (modeled on benmenwear.com) — 3 columns on desktop:
 * help links, brand blurb, newsletter. Bottom bar has copyright + legal links.
 * Server component — safe to render from app/s/[slug]/page.tsx and the
 * terms/help sub-pages.
 */
export function SiteFooter({
  slug,
  brandName,
  brand,
  description,
  location,
  whatsappLink,
  hasProducts,
  hasAbout,
  hasFaq,
  // Defaults to true so callers that don't (yet) resolve the "contact"
  // module toggle (blog list, help, terms pages) keep their existing
  // behavior — only app/s/[slug]/page.tsx passes this explicitly.
  contactEnabled = true,
  // The "משלוחים והחזרות" page doesn't exist in every build mode (a landing
  // page serves only itself + the legal pages — see lib/site-mode.ts), and a
  // footer link to a 404 is worse than no link.
  hasHelpPage = true,
  socialLinks = [],
}: {
  slug: string;
  brandName: string;
  brand: string;
  description: string | null;
  location: string | null;
  whatsappLink: string | null;
  hasProducts: boolean;
  hasAbout: boolean;
  hasFaq: boolean;
  contactEnabled?: boolean;
  hasHelpPage?: boolean;
  socialLinks?: SocialLink[];
}) {
  // The newsletter column only earns its own third when there's a real form in
  // it; otherwise the row is two full columns and one near-empty one.
  const newsletterColumn = hasProducts;

  return (
    // border-black/5, not a themed `border`: this footer hard-codes a light
    // background, so on a visitor whose OS is in dark mode the themed border
    // colour vanished against it.
    <footer data-el="chrome-footer" className="border-t border-black/5 bg-zinc-50 px-4 py-12 text-sm text-zinc-500">
      <div className={`mx-auto grid max-w-5xl gap-10 ${newsletterColumn ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {/* עזרה */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-zinc-800">עזרה</h3>
          <ul className="space-y-2">
            {hasAbout && (
              <li>
                <a href={`/s/${slug}#about`} className="hover:text-zinc-800 hover:underline">
                  אודותינו
                </a>
              </li>
            )}
            {hasFaq && (
              <li>
                <a href={`/s/${slug}#faq`} className="hover:text-zinc-800 hover:underline">
                  שאלות נפוצות
                </a>
              </li>
            )}
            {contactEnabled && (
              <li>
                <a href={`/s/${slug}#contact`} className="hover:text-zinc-800 hover:underline">
                  צור קשר
                </a>
              </li>
            )}
            <li>
              <Link href={`/s/${slug}/terms`} className="hover:text-zinc-800 hover:underline">
                תקנון האתר
              </Link>
            </li>
            {hasHelpPage && (
              <li>
                <Link href={`/s/${slug}/help`} className="hover:text-zinc-800 hover:underline">
                  משלוחים והחזרות
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* {brandName} */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-zinc-800">{brandName}</h3>
          {/* line-clamp, not slice(0,120): a character cut chopped the last
              word in half with no ellipsis. */}
          {description && <p className="line-clamp-3 leading-relaxed">{description}</p>}
          {location && <p className="mt-3">{location}</p>}
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 hover:text-zinc-800 hover:underline"
            >
              <MessageCircle className="size-4" style={{ color: brand }} />
              וואטסאפ
            </a>
          )}
          {socialLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {socialLinks.map((link) => {
                const def = platformDef(link.platform);
                if (!def) return null;
                return (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={def.label}
                    title={def.label}
                    // Neutral fill + 44px target: solid white circles glared on
                    // the professional tier's black footer, and size-9 is under
                    // the minimum touch target.
                    className="flex size-11 items-center justify-center rounded-full border border-zinc-300/60 bg-white/5 shadow-sm backdrop-blur-sm motion-safe:transition-transform motion-safe:hover:scale-110"
                    style={{ color: def.color }}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                      <path d={def.path} />
                    </svg>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* ניוזלטר — only its own column when there's a real form to put in it */}
        {newsletterColumn && (
          <div>
            <h3 className="mb-3 text-sm font-bold text-zinc-800">ניוזלטר</h3>
            <NewsletterSignup slug={slug} brand={brand} align="start" />
          </div>
        )}
        {!newsletterColumn && (contactEnabled || whatsappLink) && (
          <div className="sm:col-span-2 sm:border-t sm:border-black/5 sm:pt-6">
            <h3 className="mb-3 text-sm font-bold text-zinc-800">נשארים בקשר</h3>
            {/* Every branch points somewhere real — the old fallback read
                "עקבו אחרינו" with nothing to follow. */}
            <p className="leading-relaxed">
              רוצים לשמוע עלינו ראשונים?{" "}
              {contactEnabled ? (
                <a href={`/s/${slug}#contact`} className="font-medium hover:underline" style={{ color: brand }}>
                  השאירו פרטים
                </a>
              ) : (
                <a
                  href={whatsappLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                  style={{ color: brand }}
                >
                  דברו איתנו בוואטסאפ
                </a>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar.
          text-zinc-600, not 400: on this zinc-50 footer, zinc-400 measures
          2.57:1 — below the 4.5:1 that WCAG AA (adopted by ת"י 5568) requires
          for body text. The accessibility-statement link itself was one of the
          failing elements, which is the last place a contrast failure belongs. */}
      <div className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-black/5 pt-6 text-center text-xs text-zinc-600">
        <p>
          © {new Date().getFullYear()} {brandName}
        </p>
        <span aria-hidden="true">·</span>
        <Link href={`/s/${slug}/accessibility`} className="hover:text-zinc-900 hover:underline">
          הצהרת נגישות
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          href={process.env.NEXT_PUBLIC_APP_URL ?? "/"}
          className="hover:text-zinc-900 hover:underline"
        >
          נבנה עם{" "}
          <span className="font-medium" style={{ color: brand }}>
            AI Business Builder
          </span>
        </Link>
      </div>
    </footer>
  );
}
