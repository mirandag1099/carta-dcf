import * as XLSX from "xlsx";
import { buildSampleInputs } from "./parser";

type Cells = Record<string, string | number>;

function sheetFromCells(cells: Cells): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxR = 0;
  let maxC = 0;
  for (const [addr, val] of Object.entries(cells)) {
    const { r, c } = XLSX.utils.decode_cell(addr);
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
    ws[addr] = {
      t: typeof val === "number" ? "n" : "s",
      v: val,
    };
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  ws["!cols"] = [
    { wch: 2 }, // A
    { wch: 32 }, // B labels
    ...Array.from({ length: 7 }, () => ({ wch: 12 })), // C-I year cols
    { wch: 2 }, // J spacer
    { wch: 32 }, // K WACC labels
    { wch: 12 }, // L WACC values
  ];
  return ws;
}

export interface TemplateOptions {
  prefill?: "blank" | "starter";
  anchorYear?: number;
}

export function buildTemplateWorkbook(opts: TemplateOptions = {}): XLSX.WorkBook {
  const prefill = opts.prefill ?? "blank";
  const today = new Date();
  const anchor = opts.anchorYear ?? today.getFullYear();
  // C/D/E historical, F-I forecast scaffolding -> 7 years starting anchor-2
  const years = Array.from({ length: 7 }, (_, i) => anchor - 2 + i);
  const cols = ["C", "D", "E", "F", "G", "H", "I"];
  const anchorIdx = 2; // E

  const s = buildSampleInputs();
  const v = (n: number): number | string => (prefill === "starter" ? n : "");

  // -------- Income Statement --------
  const is: Cells = {};

  // Header
  is["B2"] = "INCOME STATEMENT";
  is["B5"] = "Valuation date";
  is["C5"] = prefill === "starter" ? "2025-12-31" : "";
  is["B7"] = "$ millions";

  // Year row
  is["B8"] = "Year";
  cols.forEach((c, i) => (is[`${c}8`] = years[i]));

  // IS labels (column B) + anchor-year sample values in column E
  const isRows: Array<[number, string, number]> = [
    [9, "Revenue", s.anchorRevenue],
    [11, "COGS", s.anchorRevenue * (1 - (s.gpMargin ?? 0))],
    [13, "GP margin (%)", s.gpMargin ?? 0],
    [16, "Operating margin (%)", s.operatingMargin ?? 0],
    [18, "EBITDA margin (%)", s.ebitdaMargin ?? 0],
    [25, "CapEx (% of revenue)", s.capexPctRevenue ?? 0],
    [27, "Change in NWC (% of revenue)", s.nwcPctRevenue ?? 0],
  ];
  for (const [row, label, sampleVal] of isRows) {
    is[`B${row}`] = label;
    is[`${cols[anchorIdx]}${row}`] = v(sampleVal);
  }

  // WACC block (column K labels / L values)
  is["K8"] = "WACC inputs";
  const waccRows: Array<[number, string, number]> = [
    [10, "Tax Rate (%)", s.taxRate],
    [13, "Levered Beta", s.leveredBeta ?? 0],
    [14, "Risk-free rate (%)", s.riskFree ?? 0],
    [17, "ERP (%)", s.erp ?? 0],
    [18, "Small-stock premium (%)", s.smallStockPremium],
    [19, "Company-specific premium (%)", s.companySpecificPremium],
    [22, "Pre-tax cost of debt (%)", s.pretaxCostOfDebt ?? 0],
  ];
  for (const [row, label, sampleVal] of waccRows) {
    is[`K${row}`] = label;
    is[`L${row}`] = v(sampleVal);
  }

  const isSheet = sheetFromCells(is);

  // -------- Balance Sheet --------
  const bs: Cells = {};
  bs["B2"] = "BALANCE SHEET";
  bs["B7"] = "$ millions";

  // Year row (bridge in column D = anchor - 1)
  bs["B8"] = "Year";
  cols.forEach((c, i) => (bs[`${c}8`] = years[i]));

  const bridgeIdx = 1; // D
  const bsRows: Array<[number, string, number]> = [
    [10, "Cash & equivalents", s.cash],
    [23, "Short-term debt", s.shortTermDebt],
    [26, "Long-term debt", s.longTermDebt],
    [29, "Common stock", s.totalEquity * 0.25],
    [30, "Series Seed", s.totalEquity * 0.2],
    [31, "Series A", s.totalEquity * 0.25],
    [32, "Retained earnings", s.totalEquity * 0.3],
  ];
  for (const [row, label, sampleVal] of bsRows) {
    bs[`B${row}`] = label;
    bs[`${cols[bridgeIdx]}${row}`] = v(sampleVal);
  }

  const bsSheet = sheetFromCells(bs);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, isSheet, "Income Statement");
  XLSX.utils.book_append_sheet(wb, bsSheet, "Balance Sheet");

  // -------- Instructions sheet --------
  const help: Cells = {
    A1: "Carta DCF Valuation — Template",
    A3: "Fill in the YELLOW cells on the Income Statement and Balance Sheet tabs.",
    A4: "Do not move labels or rename the sheets — the parser uses fixed cell locations.",
    A6: "Income Statement",
    A7: "• C5: valuation date",
    A8: "• C8:I8: seven year headers (C/D/E historical, E = anchor / latest historical, F–I forecast)",
    A9: "• Column B values (row → input):",
    A10: "    9 Revenue · 11 COGS · 13 GP margin · 16 Operating margin · 18 EBITDA margin · 25 CapEx · 27 Change in NWC",
    A11: "• WACC block — column L values (row → input):",
    A12: "    10 Tax · 13 Levered β · 14 Risk-free · 17 ERP · 18 Small-stock · 19 Company-specific · 22 Pre-tax cost of debt",
    A14: "Balance Sheet",
    A15: "• Column D values (bridge year = anchor − 1):",
    A16: "    10 Cash · 23 ST debt · 26 LT debt · 29 Common stock · 30 Series Seed · 31 Series A · 32 Retained earnings",
    A18: "All figures in $ millions. Percentages as decimals (0.70 = 70%).",
  };
  const helpSheet: XLSX.WorkSheet = {};
  for (const [addr, val] of Object.entries(help)) {
    helpSheet[addr] = { t: "s", v: val };
  }
  helpSheet["!ref"] = "A1:A20";
  helpSheet["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, helpSheet, "README");

  // Reorder so README is first
  wb.SheetNames = ["README", "Income Statement", "Balance Sheet"];

  return wb;
}

export function downloadTemplate(opts: TemplateOptions = {}): void {
  const wb = buildTemplateWorkbook(opts);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    opts.prefill === "starter"
      ? "carta-dcf-template-with-sample-data.xlsx"
      : "carta-dcf-template.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
