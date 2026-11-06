/**
 * scripts/qa-gate.mjs — the single gate every design-studio package must pass
 * before handing off (docs/design-studio/spec.md §I, P0).
 *
 * Runs four steps IN THIS ORDER and stops at the first non-zero exit:
 *
 *   1. npx eslint .        ← first, deliberately
 *   2. npx tsc --noEmit
 *   3. npx vitest run
 *   4. npm run build
 *
 * WHY ESLINT FIRST. It is not politeness and it is not alphabetical. Revision 1
 * of the spec put a `Date.now()` call inside two async server component bodies;
 * `react-hooks/purity` is an ERROR in this repo, so that is unlandable code that
 * `tsc` and `vitest` both accept happily. eslint is also the cheapest of the
 * four, so the class of failure that is hardest to spot by reading is also the
 * one reported soonest.
 *
 * WHY BUILD LAST. It is the slowest by an order of magnitude and it can only
 * fail for reasons the first three already cover, plus genuine build-time
 * problems (a server/client boundary violation, a bad dynamic import). Running
 * it before them wastes minutes on every trivial type error.
 *
 * USAGE
 *   node scripts/qa-gate.mjs                # all four
 *   node scripts/qa-gate.mjs --skip-build   # the fast loop while iterating
 *   node scripts/qa-gate.mjs --only lint    # lint | types | test | build
 *
 * Exit code 0 only when every requested step passed.
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  { id: "lint", label: "eslint", cmd: "npx", args: ["eslint", "."] },
  { id: "types", label: "tsc --noEmit", cmd: "npx", args: ["tsc", "--noEmit"] },
  { id: "test", label: "vitest run", cmd: "npx", args: ["vitest", "run"] },
  // retries: this repo lives inside a OneDrive folder, and OneDrive/Defender
  // intermittently holds a handle on .next/static long enough for `next build`
  // to die with `EPERM: unlink`. Observed alternating pass/fail on an unchanged
  // tree. A genuinely broken build still fails on the retry — the only cost is
  // one extra build on a real failure, which is the right trade for a gate.
  { id: "build", label: "next build", cmd: "npm", args: ["run", "build"], retries: 1 },
];

/** Synchronous pause — the loop below is deliberately sequential. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

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

function banner(text) {
  const line = "═".repeat(Math.max(text.length + 4, 60));
  console.log(`\n${line}\n  ${text}\n${line}`);
}

function fmtDuration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const args = parseArgs(process.argv.slice(2));
const only = args.only ? args.only.split(",").map((s) => s.trim()) : null;

const selected = STEPS.filter((s) => {
  if (only) return only.includes(s.id);
  if (args["skip-build"] === "true" && s.id === "build") return false;
  return true;
});

if (selected.length === 0) {
  console.error(`FATAL: no steps selected. Valid ids: ${STEPS.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

// Sampled once here, never inside the loop's render-equivalent path.
const startedAt = Date.now();
const results = [];
let firstFailure = null;

for (const step of selected) {
  banner(`QA GATE  ${selected.indexOf(step) + 1}/${selected.length}  —  ${step.label}`);
  const t0 = Date.now();
  const opts = { cwd: REPO_ROOT, stdio: "inherit", env: process.env };
  // npx/npm are .cmd shims on Windows, and Node >= 22 refuses to spawn a .cmd
  // without a shell (EINVAL, the batch-injection hardening). So on Windows the
  // whole command goes through the shell as ONE string — passing an args array
  // with `shell: true` instead is what triggers DEP0190. Every arg here is a
  // hard-coded literal, so there is nothing to escape.
  const isWin = process.platform === "win32";
  const invoke = () =>
    isWin
      ? spawnSync(`${step.cmd} ${step.args.join(" ")}`, { ...opts, shell: true })
      : spawnSync(step.cmd, step.args, opts);

  let run = invoke();
  for (let attempt = 0; (run.status ?? 1) !== 0 && attempt < (step.retries ?? 0); attempt++) {
    console.log(`\n… ${step.label} failed; retrying once (see the note on STEPS.build).`);
    sleepSync(2000);
    run = invoke();
  }
  const elapsed = Date.now() - t0;
  const code = run.status ?? 1;
  results.push({ label: step.label, code, elapsed });

  if (code !== 0) {
    firstFailure = step.label;
    console.log(`\n✗ ${step.label} FAILED (exit ${code}, ${fmtDuration(elapsed)})`);
    break;
  }
  console.log(`\n✓ ${step.label} passed (${fmtDuration(elapsed)})`);
}

banner("QA GATE SUMMARY");
for (const r of results) {
  console.log(`  ${r.code === 0 ? "PASS" : "FAIL"}  ${r.label.padEnd(16)} ${fmtDuration(r.elapsed).padStart(8)}`);
}
const skipped = selected.length - results.length;
if (skipped > 0) console.log(`  ----  ${skipped} step(s) not run (stopped at first failure)`);
console.log(`  total ${fmtDuration(Date.now() - startedAt)}`);

if (firstFailure) {
  console.log(`\nGATE FAILED at: ${firstFailure}. Do not hand off this package.`);
  process.exit(1);
}
console.log("\nGATE PASSED.");
