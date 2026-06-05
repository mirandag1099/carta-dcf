// DCF calculation engine. All figures in $ millions.

// Discounting convention:
//   "year-end"       — forecast years discounted at full years 1..5 back to the
//                      valuation date (end of the anchor year); terminal value
//                      at year 5. Used for uploaded reports.
//   "legacy-midyear" — the spreadsheet's exact convention (mid-year 0.5..4.5,
//                      perpetuity TV @5.5 / exit @4.5, anchor year as period 0).
//                      Used only by "Try sample data" so it reproduces the Excel.
export type ValuationConvention = "year-end" | "legacy-midyear";

export interface ParsedInputs {
  fileName: string;
  valuationDate: string;
  anchorYear: number;     // latest historical (e.g. 2025)
  bridgeYear: number;     // balance-sheet year used for weights & equity bridge
  forecastYears: number[]; // the 5 forecast periods
  convention: ValuationConvention;

  anchorRevenue: number; // latest actual revenue — the forecast base (data, not an assumption)

  // Forecast drivers (decimals, e.g. 0.03 for 3%). These are the analyst's
  // judgment — NOT read from the report — so they start null and the forecast
  // stays locked until all are entered. D&A is derived (EBITDA − operating).
  revenueGrowth: number | null;
  gpMargin: number | null;
  operatingMargin: number | null;
  ebitdaMargin: number | null;
  capexPctRevenue: number | null;
  nwcPctRevenue: number | null;

  // WACC inputs. These are NOT in an annual report — they're the analyst's
  // judgment, so they start null and the valuation stays locked until entered.
  // taxRate is the exception: it's derived from the income statement.
  taxRate: number;
  leveredBeta: number | null;
  riskFree: number | null;
  erp: number | null;
  smallStockPremium: number;
  companySpecificPremium: number;
  pretaxCostOfDebt: number | null;

  // Balance sheet (bridge year)
  cash: number;
  shortTermDebt: number;
  longTermDebt: number;
  totalEquity: number;
}

// A single historical fiscal year extracted from the report's actuals — shown
// as read-only context while the analyst enters forecast assumptions.
export interface HistoricalYear {
  year: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpense: number;
  operatingIncome: number;
  da: number;
  ebitda: number;
  ebit: number;
  tax: number;
  netIncome: number;
  capex: number;
  changeNwc: number;
}

export interface Assumptions {
  // Forecast drivers — analyst inputs; null until entered (gate the forecast).
  revenueGrowth: number | null;
  gpMargin: number | null;
  operatingMargin: number | null;
  ebitdaMargin: number | null;
  capexPctRevenue: number | null;
  nwcPctRevenue: number | null;

  // taxRate is derived from the income statement; the rest are analyst inputs
  // that start null (see ParsedInputs) and lock the valuation until entered.
  taxRate: number;
  leveredBeta: number | null;
  riskFree: number | null;
  erp: number | null;
  smallStockPremium: number;
  companySpecificPremium: number;
  pretaxCostOfDebt: number | null;

  terminalGrowth: number;
  terminalMultiple: number;
}

export interface PeriodRow {
  year: number;
  period: number;       // 0..4
  discountPeriod: number; // 0.5, 1.5, ...
  revenue: number;
  growth: number;
  cogs: number;
  grossProfit: number;
  gpMargin: number;
  opex: number;
  operatingIncome: number;
  ebitda: number;
  da: number;
  ebit: number;
  tax: number;
  nopat: number;
  capex: number;
  changeNwc: number;
  fcff: number;
  pvFcff: number | null; // null until WACC inputs are entered
}

export interface WaccBreakdown {
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  weightEquity: number;
  weightDebt: number;
  waccPrecise: number;
  waccRounded: number;
}

export interface MethodResult {
  label: string;
  tvFV: number;
  tvPV: number;
  tvDiscountYears: number; // periods the terminal value is discounted
  pvExplicit: number;
  enterpriseValue: number;
  cash: number;
  debt: number;
  equityValue: number;
}

export interface DcfOutput {
  periods: PeriodRow[];
  // Valuation outputs are null until the WACC inputs are complete. The forecast
  // (periods, minus PV) is always available because it comes from the report.
  wacc: WaccBreakdown | null;
  perpetuity: MethodResult | null;
  exitMultiple: MethodResult | null;
}

// WACC needs these analyst inputs; until they're all present we don't compute
// (or display) a WACC or any valuation. Premiums default to 0 and tax rate is
// derived from the report, so neither blocks the valuation.
export function waccComplete(a: Assumptions): boolean {
  return (
    a.riskFree != null &&
    a.leveredBeta != null &&
    a.erp != null &&
    a.pretaxCostOfDebt != null
  );
}

// The operating drivers are the analyst's forecast assumptions (not read from
// the report). Until all are entered we don't compute the forecast at all.
export function operatingComplete(a: Assumptions): boolean {
  return (
    a.revenueGrowth != null &&
    a.gpMargin != null &&
    a.operatingMargin != null &&
    a.ebitdaMargin != null &&
    a.capexPctRevenue != null &&
    a.nwcPctRevenue != null
  );
}

export function defaultAssumptions(p: ParsedInputs): Assumptions {
  return {
    revenueGrowth: p.revenueGrowth,
    gpMargin: p.gpMargin,
    operatingMargin: p.operatingMargin,
    ebitdaMargin: p.ebitdaMargin,
    capexPctRevenue: p.capexPctRevenue,
    nwcPctRevenue: p.nwcPctRevenue,
    taxRate: p.taxRate,
    leveredBeta: p.leveredBeta,
    riskFree: p.riskFree,
    erp: p.erp,
    smallStockPremium: p.smallStockPremium,
    companySpecificPremium: p.companySpecificPremium,
    pretaxCostOfDebt: p.pretaxCostOfDebt,
    terminalGrowth: 0.03,
    terminalMultiple: 3,
  };
}

// Assumes WACC inputs are present (callers guard with waccComplete).
export function computeWacc(a: Assumptions, totalEquity: number, longTermDebt: number): WaccBreakdown {
  const riskFree = a.riskFree ?? 0;
  const leveredBeta = a.leveredBeta ?? 0;
  const erp = a.erp ?? 0;
  const pretaxCostOfDebt = a.pretaxCostOfDebt ?? 0;
  const costOfEquity =
    riskFree + leveredBeta * erp + a.smallStockPremium + a.companySpecificPremium;
  const afterTaxCostOfDebt = pretaxCostOfDebt * (1 - a.taxRate);
  const denom = longTermDebt + totalEquity;
  const weightEquity = denom === 0 ? 1 : totalEquity / denom;
  const weightDebt = denom === 0 ? 0 : longTermDebt / denom;
  const waccPrecise = weightEquity * costOfEquity + weightDebt * afterTaxCostOfDebt;
  const waccRounded = Math.round(waccPrecise * 100) / 100;
  return { costOfEquity, afterTaxCostOfDebt, weightEquity, weightDebt, waccPrecise, waccRounded };
}

// Period schedule per convention: how far each forecast period sits from the
// anchor year (offset) and the discount period applied to it, plus the discount
// periods for the two terminal values.
interface Schedule {
  offsets: number[];
  discountT: number[];
  perpTvT: number;
  exitTvT: number;
}

function getSchedule(convention: ValuationConvention): Schedule {
  if (convention === "legacy-midyear") {
    return {
      offsets: [0, 1, 2, 3, 4],
      discountT: [0.5, 1.5, 2.5, 3.5, 4.5],
      perpTvT: 5.5,
      exitTvT: 4.5,
    };
  }
  // "year-end": forecast 2026..2030 discounted at full years 1..5 to end-2025,
  // both terminal values at year 5.
  return {
    offsets: [1, 2, 3, 4, 5],
    discountT: [1, 2, 3, 4, 5],
    perpTvT: 5,
    exitTvT: 5,
  };
}

export function runDcf(inputs: ParsedInputs, a: Assumptions): DcfOutput {
  // The forecast itself depends on the analyst's operating assumptions; until
  // they're all entered there's nothing to compute — return the locked shape so
  // the dashboard prompts for them. WACC then separately gates the valuation.
  if (!operatingComplete(a)) {
    return { periods: [], wacc: null, perpetuity: null, exitMultiple: null };
  }
  const revenueGrowth = a.revenueGrowth as number;
  const gpMargin = a.gpMargin as number;
  const operatingMargin = a.operatingMargin as number;
  const ebitdaMargin = a.ebitdaMargin as number;
  const capexPctRevenue = a.capexPctRevenue as number;
  const nwcPctRevenue = a.nwcPctRevenue as number;

  const wacc = waccComplete(a) ? computeWacc(a, inputs.totalEquity, inputs.longTermDebt) : null;
  const w = wacc?.waccRounded ?? null;

  const sched = getSchedule(inputs.convention);
  const periods: PeriodRow[] = [];
  for (let k = 0; k < sched.offsets.length; k++) {
    const offset = sched.offsets[k];
    const t = sched.discountT[k];
    const revenue = inputs.anchorRevenue * Math.pow(1 + revenueGrowth, offset);
    const grossProfit = revenue * gpMargin;
    const cogs = revenue - grossProfit;
    const operatingIncome = revenue * operatingMargin;
    const opex = grossProfit - operatingIncome;
    const ebitda = revenue * ebitdaMargin;
    const da = ebitda - operatingIncome;
    const ebit = ebitda - da;
    const tax = ebit * a.taxRate;
    const nopat = ebit - tax;
    const capex = revenue * capexPctRevenue;
    const changeNwc = revenue * nwcPctRevenue;
    const fcff = nopat + da - capex - changeNwc;
    const pvFcff = w != null ? fcff / Math.pow(1 + w, t) : null;
    periods.push({
      year: inputs.anchorYear + offset,
      period: k,
      discountPeriod: t,
      revenue,
      growth: offset === 0 ? 0 : revenueGrowth,
      cogs,
      grossProfit,
      gpMargin,
      opex,
      operatingIncome,
      ebitda,
      da,
      ebit,
      tax,
      nopat,
      capex,
      changeNwc,
      fcff,
      pvFcff,
    });
  }

  // Without WACC there's no present value or terminal value — return the
  // forecast only.
  if (wacc == null || w == null) {
    return { periods, wacc: null, perpetuity: null, exitMultiple: null };
  }

  const pvExplicit = periods.reduce((s, p) => s + (p.pvFcff ?? 0), 0);
  const lastFcff = periods[periods.length - 1].fcff;
  const lastRevenue = periods[periods.length - 1].revenue;

  // Perpetuity
  const termFcffPlus1 = lastFcff * (1 + a.terminalGrowth);
  const perpTvFV = termFcffPlus1 / (w - a.terminalGrowth);
  const perpTvPV = perpTvFV / Math.pow(1 + w, sched.perpTvT);
  const perpEV = pvExplicit + perpTvPV;
  const perpEquity = perpEV + inputs.cash - (inputs.shortTermDebt + inputs.longTermDebt);

  // Exit multiple
  const exitTvFV = lastRevenue * a.terminalMultiple;
  const exitTvPV = exitTvFV / Math.pow(1 + w, sched.exitTvT);
  const exitEV = pvExplicit + exitTvPV;
  const exitEquity = exitEV + inputs.cash - (inputs.shortTermDebt + inputs.longTermDebt);

  return {
    periods,
    wacc,
    perpetuity: {
      label: "Perpetuity growth",
      tvFV: perpTvFV,
      tvPV: perpTvPV,
      tvDiscountYears: sched.perpTvT,
      pvExplicit,
      enterpriseValue: perpEV,
      cash: inputs.cash,
      debt: inputs.shortTermDebt + inputs.longTermDebt,
      equityValue: perpEquity,
    },
    exitMultiple: {
      label: "Exit multiple",
      tvFV: exitTvFV,
      tvPV: exitTvPV,
      tvDiscountYears: sched.exitTvT,
      pvExplicit,
      enterpriseValue: exitEV,
      cash: inputs.cash,
      debt: inputs.shortTermDebt + inputs.longTermDebt,
      equityValue: exitEquity,
    },
  };
}

export function sensitivityGrid(
  inputs: ParsedInputs,
  a: Assumptions,
  waccCenter: number,
  waccStep = 0.01,
  growthCenter?: number,
  growthStep = 0.005,
): { waccs: number[]; growths: number[]; values: number[][] } {
  const waccs = [-2, -1, 0, 1, 2].map((k) => Math.round((waccCenter + k * waccStep) * 10000) / 10000);
  const gc = growthCenter ?? a.terminalGrowth;
  const growths = [-2, -1, 0, 1, 2].map((k) => Math.round((gc + k * growthStep) * 10000) / 10000);

  const sched = getSchedule(inputs.convention);
  // Called only when the operating drivers are complete (the Sensitivity card is
  // gated), so coalesce the nullable reads to plain numbers.
  const revenueGrowth = a.revenueGrowth ?? 0;
  const ebitdaMargin = a.ebitdaMargin ?? 0;
  const operatingMargin = a.operatingMargin ?? 0;
  const capexPctRevenue = a.capexPctRevenue ?? 0;
  const nwcPctRevenue = a.nwcPctRevenue ?? 0;
  const values = waccs.map((wRow) =>
    growths.map((g) => {
      // recompute with overridden wacc & growth, honouring the same schedule.
      const pvs: number[] = [];
      let lastFcff = 0;
      for (let k = 0; k < sched.offsets.length; k++) {
        const revenue = inputs.anchorRevenue * Math.pow(1 + revenueGrowth, sched.offsets[k]);
        const ebitda = revenue * ebitdaMargin;
        const operatingIncome = revenue * operatingMargin;
        const da = ebitda - operatingIncome;
        const ebit = ebitda - da;
        const nopat = ebit * (1 - a.taxRate);
        const capex = revenue * capexPctRevenue;
        const changeNwc = revenue * nwcPctRevenue;
        const fcff = nopat + da - capex - changeNwc;
        pvs.push(fcff / Math.pow(1 + wRow, sched.discountT[k]));
        lastFcff = fcff;
      }
      const pvExplicit = pvs.reduce((s, x) => s + x, 0);
      const tvFV = (lastFcff * (1 + g)) / (wRow - g);
      const tvPV = tvFV / Math.pow(1 + wRow, sched.perpTvT);
      const ev = pvExplicit + tvPV;
      return ev + inputs.cash - (inputs.shortTermDebt + inputs.longTermDebt);
    }),
  );

  return { waccs, growths, values };
}
