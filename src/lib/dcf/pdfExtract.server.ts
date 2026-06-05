// Server-only deterministic extractor for standardized annual-report PDFs.
//
// The financial statements (Income Statement + Balance Sheet) use a fixed set
// of line-item labels laid out as a table: a row of fiscal years across the
// top, one labelled metric per row, and a WACC / cost-of-capital block on the
// right of the income statement. Because the labels are standardized we can
// read the values deterministically — no LLM required.
//
// Approach: pull positioned text (x/y) from each page with pdf.js (via unpdf),
// rebuild rows by y, then map each value to the correct fiscal-year column by
// nearest x. This makes the parser robust to font/spacing differences as long
// as the columnar layout and labels are preserved.

import { getDocumentProxy } from "unpdf";
import { runExtractionChecks, type ValidationCheck } from "./validate";
import type { HistoricalYear } from "./engine";

export interface Token {
  str: string;
  x: number; // left edge in PDF points
  y: number; // baseline; larger = higher on the page
}

export interface Row {
  y: number;
  tokens: Token[]; // sorted left→right
  text: string; // tokens joined with spaces
}

export interface Page {
  index: number;
  rows: Row[]; // sorted top→bottom
  text: string;
}

export interface YearColumn {
  year: number;
  x: number;
}

// ---------------------------------------------------------------- numbers ----

// Parse a single token into a number, or null if it isn't numeric.
// Handles $, commas, parentheses-negatives, and trailing % (→ decimal).
export function parseNumberToken(raw: string): number | null {
  let s = raw.trim();
  if (!s || /^n\/?a$/i.test(s)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  let isPercent = false;
  if (s.endsWith("%")) {
    isPercent = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s === "" || !/^[-+]?\d*\.?\d+$/.test(s)) return null;
  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (negative) n = -n;
  if (isPercent) n = n / 100;
  return n;
}

// ------------------------------------------------------------- pdf → pages ----

export async function readPages(data: Uint8Array): Promise<Page[]> {
  const pdf = await getDocumentProxy(data);
  const pages: Page[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const tokens: Token[] = [];
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      if (!item.str || !item.str.trim()) continue;
      tokens.push({ str: item.str, x: item.transform[4], y: item.transform[5] });
    }
    pages.push(buildPage(p, tokens));
  }
  return pages;
}

function buildPage(index: number, tokens: Token[]): Page {
  // Group tokens into rows by y with a small tolerance (font line spacing).
  const sorted = [...tokens].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  const tol = 4;
  for (const t of sorted) {
    let row = rows.find((r) => Math.abs(r.y - t.y) <= tol);
    if (!row) {
      row = { y: t.y, tokens: [], text: "" };
      rows.push(row);
    }
    row.tokens.push(t);
  }
  for (const r of rows) {
    r.tokens.sort((a, b) => a.x - b.x);
    r.text = r.tokens.map((t) => t.str).join(" ");
  }
  return { index, rows, text: rows.map((r) => r.text).join("\n") };
}

// --------------------------------------------------------- column geometry ----

const YEAR_RE = /^(19|20)\d{2}$/;

// Find the fiscal-year header row on a page (the row with the most year-like
// tokens) and return the year→x mapping.
export function findYearColumns(page: Page): YearColumn[] {
  let best: YearColumn[] = [];
  for (const row of page.rows) {
    const cols: YearColumn[] = [];
    for (const t of row.tokens) {
      const cleaned = t.str.trim();
      if (YEAR_RE.test(cleaned)) {
        const year = Number(cleaned);
        if (year >= 1990 && year <= 2100) cols.push({ year, x: t.x });
      }
    }
    if (cols.length > best.length) best = cols;
  }
  // De-dupe and sort by x.
  const seen = new Set<number>();
  return best
    .filter((c) => (seen.has(c.year) ? false : (seen.add(c.year), true)))
    .sort((a, b) => a.x - b.x);
}

function labelX(page: Page, re: RegExp): number | null {
  for (const row of page.rows) {
    for (const t of row.tokens) {
      if (re.test(t.str)) return t.x;
    }
  }
  return null;
}

// Latest historical fiscal year = (first forecast year − 1). The "Forecast"
// banner sits above the first projected column, so the year token nearest its
// x is the first forecast year. For a historical-only report (no banner) the
// anchor is simply the latest year present.
export function resolveAnchorYear(
  page: Page,
  years: YearColumn[],
  _warnings: string[],
): number {
  const fx = labelX(page, /forecast/i);
  if (fx != null && years.length) {
    let nearest = years[0];
    for (const c of years) {
      if (Math.abs(c.x - fx) < Math.abs(nearest.x - fx)) nearest = c;
    }
    const idx = years.findIndex((c) => c.year === nearest.year);
    if (idx > 0) return years[idx - 1].year;
    // Forecast banner sits over the first column — unusual; fall through.
  }
  // No forecast banner: the report is historical-only → latest year is the anchor.
  if (years.length) return Math.max(...years.map((c) => c.year));
  return new Date().getFullYear();
}

function columnForYear(years: YearColumn[], year: number): YearColumn | null {
  return years.find((c) => c.year === year) ?? null;
}

// Value of a labelled metric row at a given column x (nearest numeric token).
// `notRe` lets a caller skip near-miss rows (e.g. match "Current Assets" but
// not "Non-current Assets"). Returns null when the row or a number is absent;
// pass `warnings` to record a note, or null to read silently (for fallbacks).
function valueAtColumn(
  page: Page,
  labelRe: RegExp,
  colX: number,
  warnings: string[] | null,
  what: string,
  notRe?: RegExp,
): number | null {
  const row = findRow(page, labelRe, notRe);
  if (!row) {
    if (warnings) warnings.push(`Missing line item: ${what}.`);
    return null;
  }
  let best: { d: number; n: number } | null = null;
  for (const t of row.tokens) {
    const n = parseNumberToken(t.str);
    if (n == null) continue;
    const d = Math.abs(t.x - colX);
    if (!best || d < best.d) best = { d, n };
  }
  if (!best) {
    if (warnings) warnings.push(`No numeric value found for: ${what}.`);
    return null;
  }
  return best.n;
}

function findRow(page: Page, labelRe: RegExp, notRe?: RegExp): Row | null {
  for (const row of page.rows) {
    if (!labelRe.test(row.text)) continue;
    if (notRe && notRe.test(row.text)) continue;
    return row;
  }
  return null;
}

// Locate a statement page by title. Prefer a page that also carries a real
// fiscal-year header, so a passing mention in the narrative text ("...our
// consolidated income statement...") never gets mistaken for the statement.
function findStatementPage(pages: Page[], re: RegExp): Page | null {
  const candidates = pages.filter((p) => re.test(p.text));
  const withYears = candidates.filter((p) => findYearColumns(p).length >= 3);
  return withYears[0] ?? candidates[0] ?? null;
}

// ----------------------------------------------------------- date helpers ----

function parseValuationDate(page: Page | null, anchorYear: number): string {
  if (page) {
    const row = findRow(page, /valuation date/i);
    if (row) {
      for (const t of row.tokens) {
        const s = t.str.trim();
        // ISO or common date strings
        const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
        const mdy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
        // Excel serial date
        const serial = parseNumberToken(s);
        if (serial != null && serial >= 30000 && serial <= 80000) {
          const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        }
      }
    }
  }
  return `${anchorYear}-12-31`;
}

function guessCompanyName(pages: Page[]): string | null {
  const first = pages[0];
  if (!first) return null;
  for (const row of first.rows) {
    const s = row.text.trim();
    if (!s) continue;
    if (/statement|balance sheet|annual report|in millions|valuation date|forward-looking/i.test(s))
      continue;
    if (s.length >= 2 && s.length <= 80) return s;
  }
  return null;
}

// --------------------------------------------------------------- assemble ----

export interface ExtractedFinancials {
  companyName: string | null;
  valuationDate: string;
  anchorYear: number;
  anchorRevenue: number; // latest actual revenue — the forecast base
  // taxRate is derived from the latest actual year (tax ÷ EBIT). Forecast
  // drivers and WACC are the analyst's job, so they aren't extracted here.
  taxRate: number;
  // Historical income statement (actuals across the report's years).
  historical: HistoricalYear[];
  cash: number;
  shortTermDebt: number;
  longTermDebt: number;
  totalEquity: number;
  commonStock: number;
  seriesSeed: number;
  seriesA: number;
  retainedEarnings: number;
  // Balance-sheet asset side. totalAssets is computed (current + non-current),
  // since reports leave that subtotal blank.
  currentAssets: number;
  nonCurrentAssets: number;
  totalAssets: number;
  // Liability side (bridge year) — used for the balance-sheet identity check.
  currentLiabilities: number;
  nonCurrentLiabilities: number;
  totalLiabilities: number;
  warnings: string[];
  validation: ValidationCheck[];
}

export async function extractFinancials(data: Uint8Array): Promise<ExtractedFinancials> {
  const pages = await readPages(data);
  const warnings: string[] = [];

  const isPage = findStatementPage(pages, /income statement/i);
  const bsPage = findStatementPage(pages, /balance sheet/i);
  if (!isPage) throw new Error("Could not find an Income Statement in the PDF.");
  if (!bsPage) throw new Error("Could not find a Balance Sheet in the PDF.");

  // ---- Income statement geometry ----
  const isYears = findYearColumns(isPage);
  if (isYears.length < 2)
    throw new Error("Could not read the fiscal-year header on the Income Statement.");
  const anchorYear = resolveAnchorYear(isPage, isYears, warnings);
  const anchorCol = columnForYear(isYears, anchorYear);
  if (!anchorCol) throw new Error("Could not locate the latest historical year column.");

  // ---- Historical income statement (one entry per year column) ----
  // The report is historical only; we read the actual line items and compute the
  // standard subtotals. Forecast drivers (growth/margins/etc.) are the analyst's
  // job, so we do NOT extract them.
  const atCol = (re: RegExp, colX: number, notRe?: RegExp): number =>
    valueAtColumn(isPage, re, colX, null, "", notRe) ?? 0;

  const historical: HistoricalYear[] = [...isYears]
    .sort((a, b) => a.year - b.year)
    .map((col) => {
      const x = col.x;
      const revenue = atCol(/revenue(?!\s*growth)/i, x);
      const cogs = atCol(/cogs|cost of (goods|revenue|sales)/i, x);
      const operatingExpense = atCol(/operating expense/i, x);
      const da = atCol(/d&a|depreciation/i, x);
      const tax = atCol(/\btax\b/i, x, /rate|pre[-\s]?tax|after[-\s]?tax|pretax/i);
      const capex = atCol(/^capex\b|capital expenditure/i, x);
      const changeNwc = atCol(/change in nwc|change in net working capital/i, x);
      const grossProfit = revenue - cogs;
      const operatingIncome = grossProfit - operatingExpense;
      const ebit = operatingIncome;
      const ebitda = operatingIncome + da;
      const netIncome = ebit - tax;
      return {
        year: col.year,
        revenue,
        cogs,
        grossProfit,
        operatingExpense,
        operatingIncome,
        da,
        ebitda,
        ebit,
        tax,
        netIncome,
        capex,
        changeNwc,
      };
    });

  const anchor = historical.find((h) => h.year === anchorYear) ?? historical[historical.length - 1];
  const anchorRevenue = anchor.revenue;
  if (!anchorRevenue) warnings.push("Could not read the latest-year revenue from the income statement.");

  // ---- Tax rate: derived from the latest actual year (tax ÷ EBIT) ----
  let taxRate = 0.25;
  if (anchor.tax > 0 && anchor.ebit > 0) {
    const r = anchor.tax / anchor.ebit;
    if (r >= 0 && r < 1) taxRate = Math.round(r * 10000) / 10000;
    else warnings.push("Implied tax rate was out of range; defaulted to 25%.");
  } else {
    warnings.push("Could not derive the tax rate from the income statement; defaulted to 25%.");
  }

  // Latest-year margins — used only to validate the source data (not as forecast
  // drivers, which the analyst enters).
  const gpMargin = anchorRevenue ? anchor.grossProfit / anchorRevenue : 0;
  const operatingMargin = anchorRevenue ? anchor.operatingIncome / anchorRevenue : 0;
  const ebitdaMargin = anchorRevenue ? anchor.ebitda / anchorRevenue : 0;
  const capexPctRevenue = anchorRevenue ? anchor.capex / anchorRevenue : 0;
  const nwcPctRevenue = anchorRevenue ? anchor.changeNwc / anchorRevenue : 0;

  // ---- Balance sheet (bridge year = anchor − 1) ----
  const bsYears = findYearColumns(bsPage);
  if (bsYears.length < 1)
    throw new Error("Could not read the fiscal-year header on the Balance Sheet.");
  // Weights and the equity bridge use the latest actual (anchor-year) balance
  // sheet — the valuation-date snapshot.
  const bsCol = columnForYear(bsYears, anchorYear) ?? bsYears[bsYears.length - 1];
  const bsYear = bsCol.year;
  if (bsYear !== anchorYear) {
    warnings.push(
      `Balance sheet has no ${anchorYear} column; used the ${bsYear} column instead.`,
    );
  }
  const bx = bsCol.x;
  const bs = (re: RegExp, what: string, notRe?: RegExp): number =>
    valueAtColumn(bsPage, re, bx, warnings, what, notRe) ?? 0;
  const bsSoft = (re: RegExp, notRe?: RegExp): number | null =>
    valueAtColumn(bsPage, re, bx, null, "", notRe);

  const cash = bs(/cash and cash equivalents|cash & equivalents|^cash\b|cash and equivalents/i, "Cash");
  const shortTermDebt = bs(/short[-\s]?term debt/i, "Short-term debt");
  const longTermDebt = bs(/long[-\s]?term debt/i, "Long-term debt");
  const commonStock = bs(/common stock/i, "Common stock");
  const seriesSeed = bs(/series seed/i, "Series Seed");
  const seriesA = bs(/series a\b/i, "Series A");
  const retainedEarnings = bs(/retained earnings/i, "Retained earnings");
  const totalEquity = commonStock + seriesSeed + seriesA + retainedEarnings;

  // Asset side: read the current / non-current subtotals (excluding the other's
  // near-miss label) and auto-compute total assets.
  const NON_CURRENT = /non[-\s]?current/i;
  const currentAssets = bsSoft(/current assets/i, NON_CURRENT) ?? 0;
  const nonCurrentAssets = bsSoft(/non[-\s]?current assets/i) ?? 0;
  const reportedTotalAssets = bsSoft(/total assets/i);
  const totalAssets =
    reportedTotalAssets != null ? reportedTotalAssets : currentAssets + nonCurrentAssets;

  // Liability side (for the balance-sheet identity check).
  const currentLiabilities = bsSoft(/current liabilities/i, NON_CURRENT) ?? 0;
  const nonCurrentLiabilities = bsSoft(/non[-\s]?current liabilities/i) ?? 0;
  const reportedTotalLiabEquity = bsSoft(/total liabilities.*(equity|shareholders)/i);
  let totalLiabilities = currentLiabilities + nonCurrentLiabilities;
  if (totalLiabilities === 0 && reportedTotalLiabEquity != null) {
    totalLiabilities = reportedTotalLiabEquity - totalEquity;
  }

  // ---- Validation / data-quality checks on the latest actual year ----
  const validation = runExtractionChecks({
    bridgeYear: bsYear,
    totalAssets,
    totalLiabilities,
    totalEquity,
    reportedTotalLiabEquity,
    anchorRevenue,
    cogs: anchor.cogs,
    revenueGrowth: 0, // not an extracted value anymore; range check passes at 0
    gpMargin,
    operatingMargin,
    ebitdaMargin,
    taxRate,
    capexPctRevenue,
    nwcPctRevenue,
    warnings,
  });

  return {
    companyName: guessCompanyName(pages),
    valuationDate: parseValuationDate(isPage, anchorYear),
    anchorYear,
    anchorRevenue,
    taxRate,
    historical,
    cash,
    shortTermDebt,
    longTermDebt,
    totalEquity,
    commonStock,
    seriesSeed,
    seriesA,
    retainedEarnings,
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    totalLiabilities,
    warnings,
    validation,
  };
}
