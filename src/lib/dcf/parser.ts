import * as XLSX from "xlsx";
import type { ParsedInputs } from "./engine";

export interface ValidationError {
  sheet: string;
  cell: string;
  expected: string;
  found: string;
}

export interface ParseResult {
  ok: boolean;
  errors: ValidationError[];
  inputs?: ParsedInputs;
}

function cell(ws: XLSX.WorkSheet, addr: string): unknown {
  const c = ws[addr];
  return c ? c.v : undefined;
}

function num(ws: XLSX.WorkSheet, addr: string): number {
  const v = cell(ws, addr);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return 0;
}

function str(ws: XLSX.WorkSheet, addr: string): string {
  const v = cell(ws, addr);
  return v == null ? "" : String(v);
}

function normLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9% ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function checkLabel(
  ws: XLSX.WorkSheet,
  sheet: string,
  col: string,
  row: number,
  expected: string | string[],
  errors: ValidationError[],
): void {
  const addr = `${col}${row}`;
  const actual = str(ws, addr);
  const norm = normLabel(actual);
  const expArr = Array.isArray(expected) ? expected : [expected];
  const match = expArr.some((e) => norm.includes(normLabel(e)));
  if (!match) {
    errors.push({
      sheet,
      cell: addr,
      expected: expArr.join(" / "),
      found: actual || "(empty)",
    });
  }
}

const COLS = ["C", "D", "E", "F", "G", "H", "I"];

export async function parseWorkbook(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const errors: ValidationError[] = [];

  const is = wb.Sheets["Income Statement"];
  const bs = wb.Sheets["Balance Sheet"];

  if (!is) errors.push({ sheet: "Income Statement", cell: "—", expected: "sheet 'Income Statement'", found: "missing" });
  if (!bs) errors.push({ sheet: "Balance Sheet", cell: "—", expected: "sheet 'Balance Sheet'", found: "missing" });
  if (!is || !bs) return { ok: false, errors };

  // Validate IS labels (column B)
  const isChecks: Array<[number, string | string[]]> = [
    [9, "Revenue"],
    [11, "COGS"],
    [13, ["GP margin", "Gross margin"]],
    [16, "Operating margin"],
    [18, "EBITDA margin"],
    [25, ["CapEx", "Capex"]],
    [27, ["Change in NWC", "NWC"]],
  ];
  for (const [row, label] of isChecks) {
    checkLabel(is, "Income Statement", "B", row, label, errors);
  }

  // WACC block labels (column K)
  const waccChecks: Array<[number, string | string[]]> = [
    [10, ["Tax Rate", "Tax"]],
    [13, "Levered Beta"],
    [14, ["Risk free", "Risk-free"]],
    [17, ["ERP", "Equity risk"]],
    [18, ["Small stock", "Small-stock"]],
    [19, ["Company specific", "Company-specific"]],
    [22, ["Pre tax cost of debt", "Pre-tax cost of debt", "Pretax"]],
  ];
  for (const [row, label] of waccChecks) {
    checkLabel(is, "Income Statement", "K", row, label, errors);
  }

  // BS labels
  const bsChecks: Array<[number, string | string[]]> = [
    [10, ["Cash"]],
    [23, ["Short-term debt", "Short term debt"]],
    [26, ["Long-term debt", "Long term debt"]],
    [29, ["Common stock"]],
    [30, ["Seed", "Series Seed"]],
    [31, ["Series A"]],
    [32, ["Retained earnings"]],
  ];
  for (const [row, label] of bsChecks) {
    checkLabel(bs, "Balance Sheet", "B", row, label, errors);
  }

  // Years (row 8 of IS)
  const years = COLS.map((c) => Number(cell(is, `${c}8`)));
  if (years.some((y) => !Number.isFinite(y) || y < 1900 || y > 2200)) {
    errors.push({
      sheet: "Income Statement",
      cell: "C8:I8",
      expected: "seven year numbers (e.g. 2023..2029)",
      found: years.join(", "),
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  // Anchor = latest historical = years[2] (third column, E) per spec (C/D/E historical)
  const anchorYear = years[2];
  const bridgeYear = anchorYear - 1;
  const anchorCol = "E"; // historical
  const bridgeCol = "D";

  const valuationDateRaw = cell(is, "C5");
  let valuationDate = "";
  if (typeof valuationDateRaw === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(valuationDateRaw);
    if (d) valuationDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  } else if (valuationDateRaw) {
    valuationDate = String(valuationDateRaw);
  }

  const inputs: ParsedInputs = {
    fileName: file.name,
    valuationDate,
    anchorYear,
    bridgeYear,
    forecastYears: [anchorYear, anchorYear + 1, anchorYear + 2, anchorYear + 3, anchorYear + 4],
    convention: "legacy-midyear",
    anchorRevenue: num(is, `${anchorCol}9`),
    revenueGrowth: num(is, `F9`) && num(is, `E9`)
      ? num(is, `F9`) / num(is, `E9`) - 1
      : 0.03,
    gpMargin: num(is, `${anchorCol}13`),
    operatingMargin: num(is, `${anchorCol}16`),
    ebitdaMargin: num(is, `${anchorCol}18`),
    capexPctRevenue: num(is, `${anchorCol}25`),
    nwcPctRevenue: num(is, `${anchorCol}27`),
    taxRate: num(is, "L10"),
    leveredBeta: num(is, "L13"),
    riskFree: num(is, "L14"),
    erp: num(is, "L17"),
    smallStockPremium: num(is, "L18"),
    companySpecificPremium: num(is, "L19"),
    pretaxCostOfDebt: num(is, "L22"),
    cash: num(bs, `${bridgeCol}10`),
    shortTermDebt: num(bs, `${bridgeCol}23`),
    longTermDebt: num(bs, `${bridgeCol}26`),
    totalEquity:
      num(bs, `${bridgeCol}29`) +
      num(bs, `${bridgeCol}30`) +
      num(bs, `${bridgeCol}31`) +
      num(bs, `${bridgeCol}32`),
  };

  return { ok: true, errors: [], inputs };
}

// Build a synthetic file matching the sample defaults for "try sample" UX.
export function buildSampleInputs(): ParsedInputs {
  return {
    fileName: "sample-template.xlsx",
    valuationDate: "2025-12-31",
    anchorYear: 2025,
    bridgeYear: 2024,
    forecastYears: [2025, 2026, 2027, 2028, 2029],
    convention: "legacy-midyear",
    anchorRevenue: 212.18,
    revenueGrowth: 0.03,
    gpMargin: 0.7,
    operatingMargin: 0.2,
    ebitdaMargin: 0.21,
    capexPctRevenue: 0.01,
    nwcPctRevenue: 0.05,
    taxRate: 0.25,
    leveredBeta: 1.34,
    riskFree: 0.045,
    erp: 0.0622,
    smallStockPremium: 0.1,
    companySpecificPremium: 0,
    pretaxCostOfDebt: 0.06,
    cash: 59.05,
    shortTermDebt: 1.03,
    longTermDebt: 0.5,
    totalEquity: 97.71,
  };
}
