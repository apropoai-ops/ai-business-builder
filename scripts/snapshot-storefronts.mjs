/**
 * scripts/snapshot-storefronts.mjs — parity baseline capture.
 *
 * WHY THIS EXISTS
 * The design-studio work (docs/design-studio/spec.md) rests on hard requirement 1:
 * a business with no design row must render byte-for-byte what it renders today.
 * Assertions in a spec do not prove that; a captured "before" of every live
 * storefront, re-fetched and diffed after the change, does. This script captures
 * that "before". `compare-storefronts.mjs` is the other half.
 *
 * USAGE
 *   node scripts/snapshot-storefronts.mjs                    # → docs/design-studio/baseline
 *   node scripts/snapshot-storefronts.mjs --out DIR
 *   node scripts/snapshot-storefronts.mjs --base http://localhost:3000
 *   node scripts/snapshot-storefronts.mjs --slugs a,b --routes home
 *
 * SLUG DISCOVERY (first source that yields rows wins)
 *   1. --slugs
 *   2. Supabase PostgREST: websites where published = true and slug is not null
 *      (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, read from .env.local)
 *   3. <base>/sitemap.xml — every /s/<slug> URL
 *
 * WHAT EACH SLUG+ROUTE PRODUCES
 *   <key>.html        normalised HTML, one tag per line (readable unified diffs)
 *   <key>.css         every <style> block's text, in document order, normalised
 *   <key>.attrs.txt   sorted unique digest of `class:` tokens and `data-*` attrs
 *   <key>.flight.txt  sorted RSC flight rows (see normalisation 1)
 *   index.json        manifest: base URL, capture time, per-file sha256
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS NORMALISED AWAY, AND WHY
 * Everything here was verified empirically by fetching the same production URL
 * twice and diffing; without it the baseline is noise and nobody trusts it.
 *
 * 1. RSC flight payload. Two independent kinds of per-request noise here, both
 *    observed on production:
 *    (a) chunk BOUNDARIES vary — the same page returned `"60:null\n5f:null\n"`
 *        as one push on one fetch and as two pushes on the next;
 *    (b) row IDS vary — the same client-component reference was row `63` on one
 *        fetch and row `64` on the next (module resolution races), which also
 *        rewrites every `"$L63"` reference to it inside other rows.
 *    So: every payload string is concatenated in document order, JSON-unescaped,
 *    split on "\n", each row's leading `<hex>:` id is masked to `#:` and every
 *    `"$L<hex>"` / `"$<hex>"` row reference to `"$X"`, then the rows are SORTED
 *    into <key>.flight.txt. The <script> tags themselves are dropped from the
 *    HTML. The webpack module id in a `#:I[<id>,[chunks],"Name"]` reference row
 *    is masked too — it churns on rebuild while `"Name"` (the part that says a
 *    client component appeared or vanished) does not.
 *    Consequence, stated plainly: the flight artefact no longer asserts
 *    the ORDER of a component's children — <key>.html does, and that is the one
 *    that matters for §D.4's section reordering. What flight still asserts is
 *    that the exact same set of server-rendered rows, props and text is produced.
 * 2. Deployment id. `dpl_XXXXXXXXXXXX` appears on <html data-dpl-id> and as
 *    `?dpl=` on every asset URL. It changes on every Vercel deploy. → `dpl_BUILD`.
 * 3. Content-hashed asset paths. `/_next/static/chunks/<hash>.js|.css` and
 *    `/_next/static/media/<hash>`. New build ⇒ new hash, same bytes served. → placeholder.
 * 4. CSS-module / next/font class hashes. `heebo_ad10432b-module__uojUWq__variable`
 *    embeds a build content hash and a per-build unique name; both rotate on
 *    rebuild while the computed style is identical. → `heebo_HASH-module__H__variable`.
 * 5. Storage cache-busters. `?v=<epoch-ms>` on Supabase storage URLs is derived
 *    from the row's updated_at. A migration that touches a row rewrites it
 *    without changing a pixel. → `?v=T`.
 * 6. ISO timestamps. Same reason as 5, inside the flight payload and JSON-LD
 *    (created_at / updated_at / published_at). → `TIMESTAMP`.
 * 7. Nonces and `data-reactroot`. Per-request by construction. There is no CSP
 *    nonce on the storefront today, but §E.6 of the spec adds frame-ancestors,
 *    so this is here before it is needed. → `nonce="NONCE"` / dropped.
 * 8. Whitespace between tags, and CRLF. Collapsed. Whitespace between tags is
 *    not rendered; keeping it makes every prettier run look like a regression.
 *
 * WHAT IS DELIBERATELY *NOT* NORMALISED
 * - Product / section / category ORDER. The storefront queries carry explicit
 *   `.order(...)` clauses, so order is deterministic, and silently sorting the
 *   DOM would hide exactly the class of bug §D.4's section reorder can introduce.
 *   Order changes therefore show up as an <key>.html diff while <key>.attrs.txt
 *   stays clean — compare-storefronts.mjs reports the two separately so that
 *   shape is recognisable at a glance.
 * - Any class name, inline style, or data-* value that is not a build hash.
 *   Those ARE the thing being proven unchanged.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(REPO_ROOT, "docs", "design-studio", "baseline");

// Production. NEXT_PUBLIC_APP_URL is deliberately NOT consulted: it is
// http://localhost:3000 in .env.local, and a parity baseline taken against a
// dev server proves nothing about what customers see.
const DEFAULT_BASE = "https://apropo.business";

const ALL_ROUTES = ["home", "blog", "product"];

// ── env ──────────────────────────────────────────────────────────────────────

/** Minimal .env.local reader — a bare `node` run gets none of Next's loading. */
function loadEnvLocal() {
  const file = join(REPO_ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// ── args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = "true";
  }
  return out;
}

// ── normalisation ────────────────────────────────────────────────────────────

const FLIGHT_SCRIPT_RE =
  /<script\b[^>]*>self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)<\/script>/g;

/** Concatenate + unescape every flight chunk, mask row ids, sort (see note 1). */
function extractFlightRows(html) {
  let blob = "";
  for (const m of html.matchAll(FLIGHT_SCRIPT_RE)) {
    try {
      blob += JSON.parse(m[1]);
    } catch {
      // A payload we cannot parse is kept verbatim rather than dropped, so a
      // change in it still fails the diff.
      blob += m[1];
    }
  }
  // scrubBuildNoise runs here too — the flight payload carries its own copy of
  // every dpl id, chunk path and updated_at, and forgetting it here is exactly
  // how this script first reported a false FAIL on a fresh deploy.
  return scrubBuildNoise(blob)
    .split("\n")
    .filter((l) => l.length > 0)
    .map((line) =>
      line
        .replace(/^[0-9a-f]{1,4}:/, "#:")
        // A row reference is always immediately followed by the closing quote of
        // its JSON string, so the lookahead keeps this off ordinary page text.
        .replace(/\$L?[0-9a-f]{1,4}(?=["\\])/g, "$X")
        // Webpack module id in a client-component reference row. Rebuild churn;
        // the component NAME at the end of the row is the part that carries signal.
        .replace(/^#:I\[\d+,/, "#:I[MOD,"),
    )
    .sort();
}

/** Build-varying-but-visually-identical substitutions. Applied to every artefact. */
function scrubBuildNoise(text) {
  return (
    text
      .replace(/dpl_[A-Za-z0-9]+/g, "dpl_BUILD")
      .replace(/\/_next\/static\/(chunks|media|css)\/[A-Za-z0-9._-]+/g, "/_next/static/$1/ASSET")
      .replace(
        /([A-Za-z][A-Za-z0-9]*)_[0-9a-z]{6,10}-module__[A-Za-z0-9_-]+?__([A-Za-z0-9-]+)/g,
        "$1_HASH-module__H__$2",
      )
      .replace(/([?&])v=\d{10,}/g, "$1v=T")
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "TIMESTAMP")
      .replace(/nonce="[^"]*"/g, 'nonce="NONCE"')
      .replace(/\s?data-reactroot(="[^"]*")?/g, "")
      .replace(/\r\n/g, "\n")
  );
}

/** Normalised HTML, one tag per line so unified diffs point at a single element. */
function normalizeHtml(html) {
  return scrubBuildNoise(html)
    .replace(FLIGHT_SCRIPT_RE, "")
    .replace(/>\s+</g, "><")
    .replace(/></g, ">\n<")
    .trim();
}

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/g;

function extractStyles(html) {
  const blocks = [];
  for (const m of html.matchAll(STYLE_BLOCK_RE)) blocks.push(scrubBuildNoise(m[1]).trim());
  return blocks.map((b, i) => `/* ── style block ${i} ── */\n${b}`).join("\n\n");
}

const CLASS_ATTR_RE = /\sclass(?:Name)?="([^"]*)"/g;
const DATA_ATTR_RE = /\s(data-[a-z0-9-]+)(?:="([^"]*)")?/g;

/**
 * Order-insensitive digest of the visual surface: every class token and every
 * data-* name/value that the page emits. A pure reorder leaves this identical,
 * which is how compare tells "moved" apart from "restyled".
 */
function extractAttrDigest(html) {
  const scrubbed = scrubBuildNoise(html).replace(FLIGHT_SCRIPT_RE, "");
  const set = new Set();
  for (const m of scrubbed.matchAll(CLASS_ATTR_RE)) {
    for (const token of m[1].split(/\s+/)) if (token) set.add(`class:${token}`);
  }
  for (const m of scrubbed.matchAll(DATA_ATTR_RE)) {
    set.add(m[2] === undefined ? `attr:${m[1]}` : `attr:${m[1]}=${m[2]}`);
  }
  return [...set].sort().join("\n");
}

export function snapshotFromHtml(html) {
  return {
    html: normalizeHtml(html),
    css: extractStyles(html),
    attrs: extractAttrDigest(html),
    flight: extractFlightRows(html).join("\n"),
  };
}

// ── discovery ────────────────────────────────────────────────────────────────

async function discoverFromSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const endpoint =
    `${url.replace(/\/$/, "")}/rest/v1/websites` +
    `?select=slug&published=eq.true&slug=not.is.null&order=slug.asc&limit=1000`;
  const res = await fetch(endpoint, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => r.slug).filter((s) => typeof s === "string" && s.length > 0);
}

async function discoverFromSitemap(base) {
  const res = await fetch(`${base}/sitemap.xml`);
  if (!res.ok) return null;
  const xml = await res.text();
  const slugs = new Set();
  for (const m of xml.matchAll(/\/s\/([A-Za-z0-9._~-]+)(?:<|\/)/g)) slugs.add(m[1]);
  return [...slugs].sort();
}

// ── fetching ─────────────────────────────────────────────────────────────────

async function fetchPage(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        // A stable, non-negotiating UA: Next varies nothing on it today, but a
        // baseline captured under a different UA is not comparable to one that is not.
        "user-agent": "parity-baseline/1 (design-studio)",
        "accept-language": "he-IL,he;q=0.9",
        "accept": "text/html",
      },
      redirect: "follow",
    });
    const body = res.ok ? await res.text() : "";
    return { status: res.status, body };
  } catch (err) {
    if (attempt < 2) return fetchPage(url, attempt + 1);
    return { status: 0, body: "", error: String(err?.message ?? err) };
  }
}

/** First product id linked from a store homepage — avoids a second DB round-trip. */
function firstProductId(homeHtml, slug) {
  const re = new RegExp(`/s/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/product/([0-9a-f-]{36})`);
  return homeHtml.match(re)?.[1] ?? null;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const base = (args.base ?? process.env.PARITY_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const outDir = resolve(args.out ?? DEFAULT_OUT);
  const routes = (args.routes === "all" ? ALL_ROUTES.join(",") : (args.routes ?? ALL_ROUTES.join(",")))
    .split(",")
    .map((r) => r.trim())
    .filter((r) => ALL_ROUTES.includes(r));

  let slugs = args.slugs ? args.slugs.split(",").map((s) => s.trim()).filter(Boolean) : null;
  let source = "--slugs";
  if (!slugs || slugs.length === 0) {
    slugs = await discoverFromSupabase();
    source = "supabase";
  }
  if (!slugs || slugs.length === 0) {
    slugs = await discoverFromSitemap(base);
    source = "sitemap";
  }
  if (!slugs || slugs.length === 0) {
    console.error(
      "FATAL: no published slugs found. Pass --slugs, or set NEXT_PUBLIC_SUPABASE_URL +\n" +
        `SUPABASE_SERVICE_ROLE_KEY, or make sure ${base}/sitemap.xml is reachable.`,
    );
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  console.log(`base    : ${base}`);
  console.log(`out     : ${outDir}`);
  console.log(`slugs   : ${slugs.length} (via ${source})`);
  console.log(`routes  : ${routes.join(", ")}\n`);

  const manifest = {
    // Sampled once, at the top of main — never during a render, and never inline
    // in a loop, so the manifest carries exactly one capture time.
    capturedAt: new Date().toISOString(),
    base,
    source,
    routes,
    entries: {},
  };
  let written = 0;
  let failed = 0;

  for (const slug of slugs) {
    const home = await fetchPage(`${base}/s/${slug}`);
    const jobs = [{ key: slug, path: `/s/${slug}`, page: home }];

    if (routes.includes("blog")) {
      jobs.push({ key: `${slug}__blog`, path: `/s/${slug}/blog`, page: await fetchPage(`${base}/s/${slug}/blog`) });
    }
    if (routes.includes("product")) {
      const pid = home.status === 200 ? firstProductId(home.body, slug) : null;
      if (pid) {
        jobs.push({
          key: `${slug}__product`,
          path: `/s/${slug}/product/${pid}`,
          page: await fetchPage(`${base}/s/${slug}/product/${pid}`),
        });
      }
    }
    if (!routes.includes("home")) jobs.shift();

    for (const job of jobs) {
      const { key, path, page } = job;
      if (page.status !== 200) {
        // A non-200 is itself a baseline fact: a 404 blog on a landing site must
        // still be a 404 afterwards. Recorded, not skipped.
        manifest.entries[key] = { path, status: page.status, files: {} };
        if (page.status === 0) failed++;
        console.log(`  ${page.status === 0 ? "ERR " : "SKIP"} ${key.padEnd(34)} HTTP ${page.status}${page.error ? ` (${page.error})` : ""}`);
        continue;
      }
      const snap = snapshotFromHtml(page.body);
      const files = {};
      for (const [ext, content] of [
        ["html", snap.html],
        ["css", snap.css],
        ["attrs.txt", snap.attrs],
        ["flight.txt", snap.flight],
      ]) {
        writeFileSync(join(outDir, `${key}.${ext}`), content, "utf8");
        files[ext] = createHash("sha256").update(content).digest("hex").slice(0, 16);
      }
      manifest.entries[key] = { path, status: 200, files };
      written++;
      console.log(`  OK   ${key.padEnd(34)} ${String(page.body.length).padStart(7)} B raw → ${String(snap.html.length).padStart(7)} B normalised`);
    }
  }

  writeFileSync(join(outDir, "index.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\ncaptured ${written} page(s) across ${slugs.length} slug(s); ${failed} fetch failure(s).`);
  console.log(`manifest: ${join(outDir, "index.json")}`);
  if (failed > 0) process.exit(1);
}

// Only run when invoked directly — compare-storefronts.mjs imports the normaliser.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}
