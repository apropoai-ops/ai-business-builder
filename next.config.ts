import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * These apply to EVERY route, which means every customer's public storefront
 * inherits them — the storefronts are the part of this product that strangers
 * actually visit, so they are the part worth hardening.
 *
 * On the CSP, an honest note about what it does and doesn't buy:
 * `'unsafe-inline'` stays (Next's inline bootstrap scripts + the JSON-LD
 * blocks need it without a nonce pipeline), which removes CSP's headline
 * anti-XSS property. `'unsafe-eval'` was dropped in the 2026-10 security pass:
 * it existed only for owner-configured GTM pixels, which the codebase no
 * longer renders — re-add it only together with a pixel feature that needs it.
 * What it still enforces is worth having:
 *   - scripts may only be LOADED from this origin + the named vendors, so an
 *     injection can't pull in attacker-hosted JS
 *   - object-src 'none' kills Flash/embed vectors
 *   - base-uri 'self' blocks <base> hijacking of every relative URL on the page
 *   - form-action 'self' stops an injected form from posting customer data out
 *   - frame-ancestors 'self' is the real clickjacking fix
 * Moving to nonces (and dropping unsafe-inline) means routing every request
 * through middleware — worth revisiting, but not worth breaking a paying
 * customer's conversion tracking over.
 */

const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

// Vendors the storefront legitimately loads. Anything not listed is blocked.
const ANALYTICS = [
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://connect.facebook.net",
  "https://analytics.tiktok.com",
];

const csp = [
  "default-src 'self'",
  // 'unsafe-inline': see above. No 'unsafe-eval' — nothing in prod needs it.
  `script-src 'self' 'unsafe-inline' https://js.stripe.com ${ANALYTICS.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Owners paste arbitrary https image URLs (logos, gallery, products), and
  // generated images come from several CDNs — restricting the host list here
  // would break real content for no meaningful security gain.
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  `connect-src 'self' ${SUPABASE_ORIGIN} https://api.stripe.com ${ANALYTICS.join(" ")} https://www.facebook.com`,
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://js.stripe.com https://www.googletagmanager.com",
  "worker-src 'self' blob:", // the web-push service worker
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // No `preload`: that commits the domain to a browser-baked list that is slow
  // and painful to undo. Two years of HSTS without it is the reversible 95%.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy twin of frame-ancestors, for browsers that ignore the CSP directive.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    // `payment` stays open to Stripe — Apple Pay / Google Pay need it.
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "usb=()",
      'payment=(self "https://js.stripe.com")',
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version to scanners.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Product/logo image uploads go through server actions (default is 1MB).
      // lib/actions/module-image.ts validates up to 12MB ("phone photos are
      // often 5-12MB") — this must stay above that or Next.js 413s the
      // request before validation ever runs.
      bodySizeLimit: "15mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
