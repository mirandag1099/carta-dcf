// Generates representative "annual report" PDFs for testing the deterministic
// extractor. Each report has narrative text pages (like a real 10-K) followed
// by a standardized Income Statement and a full Balance Sheet that mirror the
// line items in FinancialStatements_Excel.xlsx — WITHOUT a WACC block (those
// are the analyst's own assumptions, not part of a report) and without a DCF
// section. `generateReport` returns the PDF bytes plus the exact values the
// extractor should recover, so tests can assert against them.
import { jsPDF } from "jspdf";

// ---- deterministic RNG (mulberry32) ----
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

const COMPANIES = [
  "Acme Robotics, Inc.",
  "Northwind Materials Corp.",
  "Bluepeak Therapeutics, Inc.",
  "Cascade Logistics Group",
  "Vertex Foods Holdings, Inc.",
];

// Column geometry (mm). Numbers are right-aligned at YEAR_X; the parser maps
// values to year columns by nearest x, so only relative spacing matters.
const LABEL_X = 8;
const YEAR_X = [70, 92, 114, 136, 158, 180, 202];

function drawRow(doc, y, label, values, { bold = false, size = 8 } = {}) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  if (label) doc.text(String(label), LABEL_X, y);
  if (values) {
    values.forEach((v, i) => {
      if (v === null || v === undefined || v === "") return;
      doc.text(String(v), YEAR_X[i], y, { align: "right" });
    });
  }
  doc.setFont("helvetica", "normal");
}

const FILLER = [
  "Management's Discussion and Analysis of Financial Condition and Results of Operations.",
  "During the fiscal year the Company continued to execute against its long-term strategic plan, investing in product development, go-to-market capabilities, and operational scale. Revenue growth was driven by expansion within existing accounts as well as the addition of new logos across our core verticals.",
  "We believe our gross margin profile reflects the durability of our pricing and the increasing mix of higher-margin software and services. Operating expenses grew at a slower rate than revenue as we realized leverage in sales and marketing and general and administrative functions.",
  "Liquidity and Capital Resources. The Company funds its operations primarily through cash generated from operations. As of the balance sheet date we held cash and cash equivalents sufficient to meet anticipated working-capital and capital-expenditure needs for at least the next twelve months. Total debt remained modest relative to equity.",
  "Critical Accounting Estimates. The preparation of consolidated financial statements requires management to make estimates and assumptions that affect reported amounts of assets, liabilities, revenues and expenses. Actual results may differ from these estimates.",
  "Risk Factors. Our business is subject to numerous risks, including competition, macroeconomic conditions, customer concentration, supply-chain disruption, and changes in the regulatory environment. Any of these factors could materially affect our results of operations or financial condition in future periods.",
  "Forward-Looking Statements. This report contains forward-looking statements within the meaning of the applicable securities laws. These statements involve known and unknown risks and uncertainties; figures discussed in this narrative are illustrative and the consolidated income statement and balance sheet that follow are the authoritative source.",
];

function narrativePage(doc, title, paragraphs) {
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, 20, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 38;
  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p, 250);
    doc.text(lines, 20, y);
    y += lines.length * 6 + 4;
  }
}

export function generateReport(opts = {}) {
  const seed = opts.seed ?? 1;
  const rand = rng(seed);
  const pick = (lo, hi) => lo + rand() * (hi - lo);

  const companyName = opts.companyName ?? COMPANIES[seed % COMPANIES.length];
  // Historical-only report: actuals through 2025 (the last actual year). The
  // analyst supplies all forecast assumptions, so no forecast columns/margins.
  const anchorYear = opts.anchorYear ?? 2025;
  const years = [-2, -1, 0].map((d) => anchorYear + d); // 2023, 2024, 2025
  const anchorIdx = 2;

  // ---- Income statement drivers ----
  const base = r2(pick(120, 480));
  const g = r4(pick(0.02, 0.08));
  const gm = r4(pick(0.45, 0.75));
  const om = r4(pick(0.12, gm - 0.12));
  const daPct = r4(pick(0.01, 0.05));
  const em = r4(om + daPct);
  const capexPct = r4(pick(0.005, 0.03));
  const nwcPct = r4(pick(0.02, 0.08));

  const revenue = years.map((_, i) => r2(base * Math.pow(1 + g, i)));
  const cogs = revenue.map((rv) => r2(rv * (1 - gm)));
  const opex = revenue.map((rv) => r2(rv * (gm - om)));
  const da = revenue.map((rv) => r2(rv * daPct));
  const tax = revenue.map((rv) => r2(rv * om * 0.25));
  const capex = revenue.map((rv) => r2(rv * capexPct));
  const changeNwc = revenue.map((rv) => r2(rv * nwcPct));
  // Computed subtotals (historical actuals — shown as absolute figures).
  const grossProfit = revenue.map((rv, i) => r2(rv - cogs[i]));
  const operatingIncome = grossProfit.map((gp, i) => r2(gp - opex[i]));
  const ebitda = operatingIncome.map((oi, i) => r2(oi + da[i]));
  const ebit = operatingIncome.map((oi) => r2(oi));
  const netIncome = ebit.map((e, i) => r2(e - tax[i]));

  // ---- Balance-sheet drivers (per-year) ----
  const gbs = r4(pick(0.05, 0.18));
  const grow = (b) => years.map((_, i) => r2(b * Math.pow(1 + gbs, i)));
  const flat = (b) => years.map(() => r2(b)); // dollar amounts → 2 decimals
  const rep = (v) => years.map(() => v); // ratios/percents → keep full precision

  const cash = grow(pick(20, 100));
  const ar = grow(pick(5, 20));
  const inv = grow(pick(1, 10));
  const otherCA = grow(pick(0.5, 5));
  const ppe = flat(pick(10, 50));
  const intang = flat(pick(2, 15));
  const otherNCA = flat(pick(1, 8));

  const ap = grow(pick(1, 5));
  const stDebt = flat(pick(0.5, 3));
  const otherCL = grow(pick(0.5, 3));
  const ltDebt = flat(pick(0.2, 2));
  const otherNCL = flat(pick(0, 1));

  const commonStock = flat(pick(10, 30));
  const seriesSeed = flat(pick(2, 6));
  const seriesA = flat(pick(4, 10));

  const sum = (arrs, i) => r2(arrs.reduce((s, a) => s + a[i], 0));
  const currentAssets = years.map((_, i) => sum([cash, ar, inv, otherCA], i));
  const nonCurrentAssets = years.map((_, i) => sum([ppe, intang, otherNCA], i));
  const totalAssets = years.map((_, i) => r2(currentAssets[i] + nonCurrentAssets[i]));
  const currentLiab = years.map((_, i) => sum([ap, stDebt, otherCL], i));
  const nonCurrentLiab = years.map((_, i) => sum([ltDebt, otherNCL], i));
  const liabilities = years.map((_, i) => r2(currentLiab[i] + nonCurrentLiab[i]));

  // Retained earnings is the balancing plug so Assets = Liabilities + Equity
  // (a real balance sheet always ties). For the "broken" demo sample we skip
  // the plug so the validation panel catches the imbalance.
  const retained = opts.broken
    ? grow(pick(20, 80))
    : years.map((_, i) =>
        r2(totalAssets[i] - liabilities[i] - commonStock[i] - seriesSeed[i] - seriesA[i]),
      );
  const equity = years.map((_, i) => sum([commonStock, seriesSeed, seriesA, retained], i));
  const totalLiabEq = years.map((_, i) => r2(liabilities[i] + equity[i]));

  // ============================ build the PDF ============================
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Cover page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(companyName, 20, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(`Annual Report — Fiscal Year ${anchorYear}`, 20, 52);
  doc.setFontSize(10);
  doc.text(
    doc.splitTextToSize(
      "This Annual Report includes management's discussion, risk factors, and the audited consolidated financial statements. All figures in millions of US dollars unless otherwise noted.",
      250,
    ),
    20,
    66,
  );

  // Narrative pages (the parser must look past these)
  narrativePage(doc, "Management's Discussion and Analysis", FILLER.slice(0, 4));
  narrativePage(doc, "Risk Factors", FILLER.slice(4));

  // ---- Income Statement page ----
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Consolidated Income Statement", LABEL_X, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Valuation Date", LABEL_X, 24);
  doc.text(`${anchorYear}-12-31`, 45, 24);
  doc.setFontSize(8);
  doc.text("(In millions)", LABEL_X, 30);
  doc.text("Historical actuals", YEAR_X[0], 36);
  drawRow(doc, 42, "", years, { bold: true });

  let y = 48;
  const step = 6.2;
  const next = () => ((y += step), y - step);
  drawRow(doc, next(), "Revenue", revenue);
  drawRow(doc, next(), "COGS", cogs);
  drawRow(doc, next(), "Gross Profit", grossProfit);
  drawRow(doc, next(), "Operating Expense", opex);
  drawRow(doc, next(), "Operating Income", operatingIncome);
  drawRow(doc, next(), "D&A", da);
  drawRow(doc, next(), "EBITDA", ebitda);
  drawRow(doc, next(), "EBIT", ebit);
  drawRow(doc, next(), "Tax", tax);
  drawRow(doc, next(), "Net Income", netIncome);
  drawRow(doc, next(), "CapEx", capex);
  drawRow(doc, next(), "Change in NWC", changeNwc);

  // ---- Balance Sheet page ----
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Consolidated Balance Sheet", LABEL_X, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("(In millions)", LABEL_X, 24);
  doc.text("Historical actuals", YEAR_X[0], 30);
  drawRow(doc, 36, "", years, { bold: true });

  y = 44;
  const line = (label, vals, bold = false) => drawRow(doc, next(), label, vals, { bold });
  line("Assets", null, true);
  line("Current Assets", currentAssets, true);
  line("Cash and cash equivalents", cash);
  line("Accounts receivable", ar);
  line("Inventories", inv);
  line("Other current assets", otherCA);
  line("Non-current Assets", nonCurrentAssets, true);
  line("Property, plant and equipment", ppe);
  line("Intangible Assets", intang);
  line("Other non-current assets", otherNCA);
  line("Total Assets", null, true); // blank — app computes current + non-current
  line("Liabilities & Shareholders' Equity", null, true);
  line("Liabilities", liabilities, true);
  line("Current Liabilities", currentLiab, true);
  line("Accounts payable", ap);
  line("Short-term debt", stDebt);
  line("Other current liabilities", otherCL);
  line("Non-current Liabilities", nonCurrentLiab, true);
  line("Long-term debt", ltDebt);
  line("Other non-current liabilities", otherNCL);
  line("Equity", equity, true);
  line("Common stock", commonStock);
  line("Series Seed Preferred stock", seriesSeed);
  line("Series A Preferred stock", seriesA);
  line("Retained Earnings", retained);
  line("Total Liabilities & Shareholders' Equity", totalLiabEq, true);

  const bytes = new Uint8Array(doc.output("arraybuffer"));

  const historical = years.map((yr, i) => ({
    year: yr,
    revenue: revenue[i],
    cogs: cogs[i],
    grossProfit: grossProfit[i],
    operatingExpense: opex[i],
    operatingIncome: operatingIncome[i],
    da: da[i],
    ebitda: ebitda[i],
    ebit: ebit[i],
    tax: tax[i],
    netIncome: netIncome[i],
    capex: capex[i],
    changeNwc: changeNwc[i],
  }));

  const expected = {
    companyName,
    valuationDate: `${anchorYear}-12-31`,
    anchorYear,
    anchorRevenue: revenue[anchorIdx],
    // Tax rate derived from the latest actual year (tax ÷ EBIT, EBIT = operating income).
    taxRate: Math.round((tax[anchorIdx] / ebit[anchorIdx]) * 10000) / 10000,
    // Balance sheet at the latest actual year (anchor = 2025).
    cash: cash[anchorIdx],
    shortTermDebt: stDebt[anchorIdx],
    longTermDebt: ltDebt[anchorIdx],
    totalEquity:
      commonStock[anchorIdx] + seriesSeed[anchorIdx] + seriesA[anchorIdx] + retained[anchorIdx],
    currentAssets: currentAssets[anchorIdx],
    nonCurrentAssets: nonCurrentAssets[anchorIdx],
    totalAssets: currentAssets[anchorIdx] + nonCurrentAssets[anchorIdx],
  };

  return { bytes, expected, historical, companyName, anchorYear };
}
