// Generates randomized sample annual-report PDFs (narrative pages + a
// standardized Income Statement + a full Balance Sheet, no WACC block) into
// public/samples/, then runs the deterministic extractor on each and asserts:
//   - every recovered value matches what the generator put in, and
//   - the 4 good reports pass validation, while a 5th intentionally
//     unbalanced report is caught by the balance-sheet check.
// Run: npx tsx scripts/make-samples.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { generateReport } from "./report-generator.mjs";
import { extractFinancials } from "../src/lib/dcf/pdfExtract.server.ts";
import { overallStatus } from "../src/lib/dcf/validate.ts";

const OUT_DIR = "public/samples";
mkdirSync(OUT_DIR, { recursive: true });

const TOL = 1e-6;
let allPass = true;

async function check(seed, path, opts, expectValidation) {
  const { bytes, expected, historical, companyName, anchorYear } = generateReport({ seed, ...opts });
  writeFileSync(path, bytes);
  const got = await extractFinancials(bytes);

  const fails = [];
  for (const [k, exp] of Object.entries(expected)) {
    const g = got[k];
    const ok = typeof exp === "number" ? Math.abs(g - exp) <= TOL : g === exp;
    if (!ok) fails.push(`${k}: got ${JSON.stringify(g)} expected ${JSON.stringify(exp)}`);
  }

  // Forecast drivers must NOT be extracted (analyst's inputs).
  for (const k of ["revenueGrowth", "gpMargin", "operatingMargin", "ebitdaMargin", "capexPctRevenue", "nwcPctRevenue"]) {
    if (k in got) fails.push(`${k} should not be extracted (analyst input)`);
  }

  // Historical series matches what the generator drew.
  if (got.historical.length !== historical.length) {
    fails.push(`historical length: got ${got.historical.length} expected ${historical.length}`);
  } else {
    for (let i = 0; i < historical.length; i++) {
      for (const [k, exp] of Object.entries(historical[i])) {
        const g = got.historical[i][k];
        if (Math.abs(g - exp) > TOL) fails.push(`historical[${i}].${k}: got ${g} expected ${exp}`);
      }
    }
  }

  const vStatus = overallStatus(got.validation);
  const balance = got.validation.find((c) => c.id === "bs-balances");
  if (vStatus !== expectValidation) {
    fails.push(`validation status: got "${vStatus}" expected "${expectValidation}"`);
  }

  const status = fails.length === 0 ? "PASS ✅" : "FAIL ❌";
  if (fails.length) allPass = false;
  console.log(`\n${companyName} (FY${anchorYear}) → ${path}  [${status}]`);
  console.log(
    `   anchorRev=${got.anchorRevenue}  tax=${got.taxRate}  hist years=${got.historical.map((h) => h.year).join(",")}` +
      `  cash=${got.cash} equity=${got.totalEquity.toFixed(2)}`,
  );
  console.log(
    `   assets=${got.totalAssets.toFixed(2)}  liabilities=${got.totalLiabilities.toFixed(2)}  equity=${got.totalEquity.toFixed(2)}` +
      `  → validation: ${vStatus.toUpperCase()}  | ${balance?.detail ?? ""}`,
  );
  if (fails.length) fails.forEach((f) => console.log(`   ✗ ${f}`));
}

for (let seed = 1; seed <= 4; seed++) {
  await check(seed, `${OUT_DIR}/sample-report-${seed}.pdf`, {}, "pass");
}
// Intentionally unbalanced report — should be flagged by the validation panel.
await check(99, `${OUT_DIR}/sample-report-broken.pdf`, { broken: true, companyName: "Brokenco Industries, Inc." }, "fail");

console.log(
  allPass
    ? "\nAll samples behaved as expected ✅ (4 valid, 1 caught by validation)"
    : "\nSome checks did not match ❌",
);
process.exit(allPass ? 0 : 1);
