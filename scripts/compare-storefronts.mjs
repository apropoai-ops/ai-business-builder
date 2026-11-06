/**
 * scripts/compare-storefronts.mjs — the other half of the parity proof.
 *
 * WHY THIS EXISTS
 * `snapshot-storefronts.mjs` captured the "before". This re-fetches the same
 * pages (or reads a second snapshot directory) and diffs them against it. Hard
 * requirement 1 of docs/design-studio/spec.md — a business with no design row
 * renders exactly what it renders today — is only ever *demonstrated* here.
 *
 * USAGE
 *   node scripts/compare-storefronts.mjs                          # re-fetch live vs docs/design-studio/baseline
 *   node scripts/compare-storefronts.mjs --baseline DIR
 *   node scripts/compare-storefronts.mjs --base http://localhost:3000
 *   node scripts/compare-storefronts.mjs BEFORE_DIR AFTER_DIR     # two captured dirs, no network
 *   node scripts/compare-storefronts.mjs --context 40             # diff lines to print per artefact
 *
 * Exit code 1 on any FAIL. Exit 0 only when every page matches on all four
 * artefacts. Normalisation is imported from the snapshot script so the two can
 * never drift apart.
 *
 * READING THE OUTPUT
 * Each page is compared on four artefacts and each is reported separately,
 * because the combination tells you what kind of change you are looking at:
 *   html   differs, attrs clean  → elements MOVED or text changed; nothing restyled
 *   attrs  differs               → a class or data-* was added/removed/changed — a real style risk
 *   css    differs               → a <style> block changed (this is where ThemeStyle lands)
 *   flight differs, html clean   → a server prop changed that the DOM does not show
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { snapshotFromHtml } from "./snapshot-storefronts.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BASELINE = join(REPO_ROOT, "docs", "design-studio", "baseline");
const DEFAULT_BASE = "https://apropo.business";
const ARTEFACTS = ["html", "css", "attrs.txt", "flight.txt"];

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[a.slice(2)] = argv[++i];
    else flags[a.slice(2)] = "true";
  }
  return { flags, positional };
}

/**
 * Minimal LCS unified diff. Deliberately not a dependency: this script has to
 * run in a bare `node` with nothing installed, including on a machine where the
 * whole point is that `npm ci` has not happened yet.
 */
function unifiedDiff(before, after, limit) {
  const a = before.split("\n");
  const b = after.split("\n");

  // Trim the common head/tail first so the O(n·m) table only ever sees the
  // genuinely differing window — full storefront HTML is ~3k lines.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);

  const out = [];
  const MAX = 2000;
  if (midA.length > MAX || midB.length > MAX) {
    // Too large to LCS cheaply; fall back to a positional dump of the window.
    for (let i = 0; i < Math.max(midA.length, midB.length) && out.length < limit; i++) {
      if (midA[i] !== midB[i]) {
        if (midA[i] !== undefined) out.push({ sign: "-", line: head + i + 1, text: midA[i] });
        if (midB[i] !== undefined) out.push({ sign: "+", line: head + i + 1, text: midB[i] });
      }
    }
    return { changes: out, truncated: true };
  }

  const n = midA.length;
  const m = midB.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ sign: "-", line: head + i + 1, text: midA[i++] });
    } else {
      out.push({ sign: "+", line: head + j + 1, text: midB[j++] });
    }
    if (out.length >= limit) return { changes: out, truncated: true };
  }
  while (i < n && out.length < limit) out.push({ sign: "-", line: head + i + 1, text: midA[i++] });
  while (j < m && out.length < limit) out.push({ sign: "+", line: head + j + 1, text: midB[j++] });
  return { changes: out, truncated: i < n || j < m };
}

function printDiff(label, before, after, limit) {
  const { changes, truncated } = unifiedDiff(before, after, limit);
  console.log(`    ── ${label} ──`);
  for (const c of changes) {
    const text = c.text.length > 300 ? `${c.text.slice(0, 300)}…` : c.text;
    console.log(`    ${c.sign} ${String(c.line).padStart(5)} | ${text}`);
  }
  if (truncated) console.log(`    … (truncated at ${limit} lines; raise with --context)`);
}

function readArtefacts(dir, key) {
  const found = {};
  for (const ext of ARTEFACTS) {
    const file = join(dir, `${key}.${ext}`);
    if (existsSync(file)) found[ext] = readFileSync(file, "utf8");
  }
  return found;
}

function keysIn(dir) {
  const manifestPath = join(dir, "index.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return { manifest, keys: Object.keys(manifest.entries ?? {}) };
  }
  // No manifest (e.g. a hand-made directory): infer keys from the .html files.
  const keys = readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.slice(0, -5))
    .sort();
  return { manifest: null, keys };
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "parity-baseline/1 (design-studio)",
      "accept-language": "he-IL,he;q=0.9",
      "accept": "text/html",
    },
    redirect: "follow",
  });
  return { status: res.status, body: res.ok ? await res.text() : "" };
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const limit = Number(flags.context ?? 30) || 30;

  const beforeDir = resolve(positional[0] ?? flags.baseline ?? DEFAULT_BASELINE);
  const afterDir = positional[1] ? resolve(positional[1]) : null;
  const base = (flags.base ?? process.env.PARITY_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");

  if (!existsSync(beforeDir)) {
    console.error(`FATAL: baseline directory not found: ${beforeDir}`);
    console.error("Run `node scripts/snapshot-storefronts.mjs` first.");
    process.exit(1);
  }
  const { manifest, keys } = keysIn(beforeDir);
  if (keys.length === 0) {
    console.error(`FATAL: baseline directory is empty: ${beforeDir}`);
    process.exit(1);
  }

  console.log(`before  : ${beforeDir}`);
  console.log(afterDir ? `after   : ${afterDir}` : `after   : live fetch from ${base}`);
  console.log(`pages   : ${keys.length}\n`);

  let pass = 0;
  let fail = 0;
  const failures = [];

  for (const key of keys) {
    const entry = manifest?.entries?.[key];
    const beforeArt = readArtefacts(beforeDir, key);

    let afterArt;
    let statusNote = "";

    if (afterDir) {
      afterArt = readArtefacts(afterDir, key);
      if (Object.keys(afterArt).length === 0 && Object.keys(beforeArt).length === 0) {
        // Both sides recorded a non-200; nothing to diff.
        console.log(`PASS  ${key.padEnd(34)} (no body on either side)`);
        pass++;
        continue;
      }
    } else {
      // Without index.json a product key carries no id, so it cannot be re-fetched.
      const path = entry?.path ?? (key.endsWith("__product") ? null : `/s/${key.replace(/__blog$/, "")}${key.endsWith("__blog") ? "/blog" : ""}`);
      if (!path) {
        console.log(`SKIP  ${key.padEnd(34)} no index.json — cannot recover the product URL`);
        continue;
      }
      let page;
      try {
        page = await fetchPage(`${base}${path}`);
      } catch (err) {
        console.log(`FAIL  ${key.padEnd(34)} fetch error: ${String(err?.message ?? err)}`);
        fail++;
        failures.push(key);
        continue;
      }
      const expectedStatus = entry?.status ?? 200;
      if (page.status !== expectedStatus) {
        console.log(`FAIL  ${key.padEnd(34)} HTTP ${page.status}, baseline was ${expectedStatus}`);
        fail++;
        failures.push(key);
        continue;
      }
      if (page.status !== 200) {
        console.log(`PASS  ${key.padEnd(34)} HTTP ${page.status} (matches baseline)`);
        pass++;
        continue;
      }
      const snap = snapshotFromHtml(page.body);
      afterArt = {
        html: snap.html,
        css: snap.css,
        "attrs.txt": snap.attrs,
        "flight.txt": snap.flight,
      };
      statusNote = ` (${page.body.length} B raw)`;
    }

    const differing = ARTEFACTS.filter((ext) => (beforeArt[ext] ?? "") !== (afterArt[ext] ?? ""));
    if (differing.length === 0) {
      console.log(`PASS  ${key.padEnd(34)}${statusNote}`);
      pass++;
      continue;
    }

    console.log(`FAIL  ${key.padEnd(34)} differs in: ${differing.join(", ")}`);
    fail++;
    failures.push(key);
    for (const ext of differing) {
      printDiff(ext, beforeArt[ext] ?? "", afterArt[ext] ?? "", limit);
    }
    console.log("");
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`PASS ${pass}   FAIL ${fail}`);
  if (fail > 0) {
    console.log(`failing pages: ${failures.join(", ")}`);
    console.log("Parity is NOT proven. Every diff above is a visual change you did not intend.");
    process.exit(1);
  }
  console.log("Parity proven: every page is byte-identical after normalisation.");
}

await main();
