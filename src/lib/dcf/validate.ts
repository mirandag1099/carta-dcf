// Validation / data-quality checks. Two flavours:
//   - Extraction checks: run once at extraction time on the figures pulled from
//     the PDF (accounting identity, internal consistency, plausible ranges).
//   - Model checks: run in the UI from the live DCF output, so they re-evaluate
//     as the analyst edits assumptions (e.g. perpetuity convergence).
// These directly answer the interview's "how do you validate the automated
// output before sending it to a client?" — the analyst sees, at a glance,
// whether the numbers tie out before trusting the valuation.

import type { Assumptions, DcfOutput, ParsedInputs } from "./engine";
import { operatingComplete, waccComplete } from "./engine";
import { fmtMoney, fmtPct } from "./format";

export type CheckStatus = "pass" | "warn" | "fail";

export interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ExtractionCheckInput {
  bridgeYear: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  reportedTotalLiabEquity: number | null;
  anchorRevenue: number;
  cogs: number | null;
  revenueGrowth: number;
  gpMargin: number;
  operatingMargin: number;
  ebitdaMargin: number;
  taxRate: number;
  capexPctRevenue: number;
  nwcPctRevenue: number;
  warnings: string[];
}

const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

// Source-data checks computed at extraction time (don't depend on assumptions).
export function runExtractionChecks(x: ExtractionCheckInput): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // 1. Accounting identity: Assets = Liabilities + Equity (bridge year).
  const le = x.totalLiabilities + x.totalEquity;
  const diff = x.totalAssets - le;
  const tol = Math.max(0.05, Math.abs(x.totalAssets) * 0.01);
  checks.push({
    id: "bs-balances",
    label: `Balance sheet balances (${x.bridgeYear})`,
    status: Math.abs(diff) <= tol ? "pass" : "fail",
    detail:
      `Assets ${fmtMoney(x.totalAssets)} vs. Liabilities + Equity ${fmtMoney(le)}` +
      (Math.abs(diff) <= tol ? " — ties out." : ` — off by ${fmtMoney(diff)}.`),
  });

  // 2. Reported Total Liabilities & Equity ties to total assets (if present).
  if (x.reportedTotalLiabEquity != null) {
    const d2 = x.totalAssets - x.reportedTotalLiabEquity;
    checks.push({
      id: "total-le-ties",
      label: "Reported total L&E ties to total assets",
      status: Math.abs(d2) <= tol ? "pass" : "warn",
      detail: `Total assets ${fmtMoney(x.totalAssets)} vs. reported total L&E ${fmtMoney(
        x.reportedTotalLiabEquity,
      )}.`,
    });
  }

  // 3. Gross profit reconciles with the stated GP margin.
  if (x.cogs != null && x.anchorRevenue > 0) {
    const impliedGp = (x.anchorRevenue - x.cogs) / x.anchorRevenue;
    const off = Math.abs(impliedGp - x.gpMargin);
    checks.push({
      id: "gp-reconciles",
      label: "Gross margin reconciles with COGS",
      status: off <= 0.005 ? "pass" : "warn",
      detail: `(Revenue − COGS) / Revenue = ${fmtPct(impliedGp, 1)} vs. stated GP margin ${fmtPct(
        x.gpMargin,
        1,
      )}.`,
    });
  }

  // 4. Margin ordering: GP ≥ operating, EBITDA ≥ operating.
  const ordered = x.gpMargin >= x.operatingMargin && x.ebitdaMargin >= x.operatingMargin;
  checks.push({
    id: "margin-ordering",
    label: "Margins are internally consistent",
    status: ordered ? "pass" : "fail",
    detail: `GP ${fmtPct(x.gpMargin, 1)} ≥ Operating ${fmtPct(
      x.operatingMargin,
      1,
    )}; EBITDA ${fmtPct(x.ebitdaMargin, 1)} ≥ Operating.`,
  });

  // 5. Plausible ranges for the report-derived ratios.
  const rangeIssues: string[] = [];
  if (!inRange(x.gpMargin, 0, 1)) rangeIssues.push("GP margin");
  if (!inRange(x.operatingMargin, 0, 1)) rangeIssues.push("operating margin");
  if (!inRange(x.ebitdaMargin, 0, 1)) rangeIssues.push("EBITDA margin");
  if (!inRange(x.taxRate, 0, 0.6)) rangeIssues.push("tax rate");
  if (!inRange(x.capexPctRevenue, 0, 0.5)) rangeIssues.push("CapEx %");
  if (!inRange(x.nwcPctRevenue, 0, 0.5)) rangeIssues.push("ΔNWC %");
  if (!inRange(x.revenueGrowth, -0.5, 1)) rangeIssues.push("revenue growth");
  checks.push({
    id: "ranges",
    label: "Extracted ratios are within plausible ranges",
    status: rangeIssues.length === 0 ? "pass" : "warn",
    detail:
      rangeIssues.length === 0
        ? "Margins, tax rate, CapEx %, ΔNWC % and growth all look reasonable."
        : `Out of range: ${rangeIssues.join(", ")}.`,
  });

  // 6. Extraction completeness — surface any parser warnings.
  checks.push({
    id: "completeness",
    label: "Extraction completeness",
    status: x.warnings.length === 0 ? "pass" : "warn",
    detail:
      x.warnings.length === 0
        ? "All required line items were found in the PDF."
        : `${x.warnings.length} note${x.warnings.length === 1 ? "" : "s"}: ${x.warnings.join(" ")}`,
  });

  return checks;
}

// Model-level checks computed from the live DCF output (re-run as assumptions
// change). Returns an empty-ish set with a "pending" note until WACC is entered.
export function runModelChecks(
  _inputs: ParsedInputs,
  assumptions: Assumptions,
  output: DcfOutput,
): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Forecast drivers are the analyst's inputs — flag until all are entered.
  if (!operatingComplete(assumptions)) {
    checks.push({
      id: "operating-pending",
      label: "Forecast assumptions entered",
      status: "warn",
      detail:
        "Enter revenue growth, gross / operating / EBITDA margins, CapEx % and ΔNWC % in the sidebar to build the forecast.",
    });
    return checks;
  }

  // EBITDA margin must be ≥ operating margin (D&A = EBITDA − operating income ≥ 0).
  if (assumptions.ebitdaMargin != null && assumptions.operatingMargin != null) {
    const daImplied = assumptions.ebitdaMargin >= assumptions.operatingMargin;
    checks.push({
      id: "da-nonnegative",
      label: "Implied D&A is non-negative",
      status: daImplied ? "pass" : "fail",
      detail: `EBITDA margin ${fmtPct(assumptions.ebitdaMargin, 1)} must be ≥ operating margin ${fmtPct(
        assumptions.operatingMargin,
        1,
      )} (D&A = the difference).`,
    });
  }

  if (!waccComplete(assumptions) || !output.wacc || !output.perpetuity || !output.exitMultiple) {
    checks.push({
      id: "wacc-pending",
      label: "Cost of capital entered",
      status: "warn",
      detail: "Enter the WACC inputs in the sidebar to compute and validate the valuation.",
    });
    return checks;
  }

  // Perpetuity only converges when WACC > terminal growth.
  const converges = output.wacc.waccRounded > assumptions.terminalGrowth;
  checks.push({
    id: "perpetuity-converges",
    label: "Perpetuity terminal value converges",
    status: converges ? "pass" : "fail",
    detail: `WACC ${fmtPct(output.wacc.waccRounded, 1)} must exceed terminal growth ${fmtPct(
      assumptions.terminalGrowth,
      1,
    )}.`,
  });

  // Equity values should be positive to be meaningful.
  const minEquity = Math.min(output.perpetuity.equityValue, output.exitMultiple.equityValue);
  checks.push({
    id: "equity-positive",
    label: "Equity value is positive",
    status: minEquity > 0 ? "pass" : "warn",
    detail: `Perpetuity ${fmtMoney(output.perpetuity.equityValue)}, exit multiple ${fmtMoney(
      output.exitMultiple.equityValue,
    )}.`,
  });

  return checks;
}

export function overallStatus(checks: ValidationCheck[]): CheckStatus {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "pass";
}
