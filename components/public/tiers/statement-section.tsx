import { safeHexColor } from "@/components/public/tiers/color-utils";

/**
 * Big editorial "statement" block — a full-bleed black band with one large
 * thin quote, used by the "advanced" tier to break up the page rhythm the
 * way an Awwvards-style editorial site would (a single confident claim, not
 * another boxed testimonial card). `data-reveal` opts it into the site's
 * existing scroll-reveal system (see components/public/site-effects.tsx).
 */
export function StatementSection({
  quote,
  author,
  accent,
  dark = true,
}: {
  quote: string;
  author?: string | null;
  accent: string;
  dark?: boolean;
}) {
  if (!quote || !quote.trim()) return null;
  const safeAccent = safeHexColor(accent);

  const bg = dark ? "#000000" : "#ffffff";
  const fg = dark ? "#ffffff" : "#141414";
  const sub = dark ? "#9a9a9a" : "#6b6b6b";

  return (
    <section className="tier-statement" style={{ background: bg, color: fg }} data-reveal>
      <div className="tier-statement-inner">
        <span className="tier-statement-mark" style={{ color: safeAccent }} aria-hidden="true">
          &ldquo;
        </span>
        <p className="tier-statement-quote">{quote}</p>
        {author && (
          <p className="tier-statement-author" style={{ color: sub }}>
            — {author}
          </p>
        )}
        <span className="tier-statement-rule" style={{ background: safeAccent }} aria-hidden="true" />
      </div>
      <style>{`
        .tier-statement {
          width: 100%;
          padding-block: clamp(4rem, 10vw, 8rem);
          padding-inline: 1.5rem;
        }
        .tier-statement-inner {
          max-width: 56rem;
          margin-inline: auto;
          text-align: center;
        }
        .tier-statement-mark {
          display: block;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(3rem, 8vw, 6rem);
          line-height: 1;
          margin-bottom: -0.5rem;
        }
        .tier-statement-quote {
          font-weight: 250;
          font-size: clamp(1.5rem, 1.05rem + 2.2vw, 3rem);
          line-height: 1.35;
          letter-spacing: -0.01em;
          text-wrap: balance;
        }
        .tier-statement-author {
          margin-top: 1.75rem;
          font-size: .95rem;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .tier-statement-rule {
          display: block;
          width: 64px;
          height: 2px;
          margin: 2rem auto 0;
        }
      `}</style>
    </section>
  );
}
