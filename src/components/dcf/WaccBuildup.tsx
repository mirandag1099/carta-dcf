import type { Assumptions, DcfOutput, ParsedInputs } from "@/lib/dcf/engine";
import { fmtMoney, fmtPct } from "@/lib/dcf/format";
import { Card } from "./ForecastTable";
import { Locked } from "./Locked";

export function WaccBuildup({
  output,
  assumptions,
  inputs,
}: {
  output: DcfOutput;
  assumptions: Assumptions;
  inputs: ParsedInputs;
}) {
  const { wacc } = output;
  const a = assumptions;

  if (!wacc) {
    return (
      <Locked
        title="Weighted-average cost of capital"
        subtitle="Cost of equity (CAPM) → WACC"
        message="WACC isn't computed yet. Enter the risk-free rate, levered beta, equity risk premium and pre-tax cost of debt in the sidebar — these are analyst inputs, not part of the annual report."
      />
    );
  }

  const capm: Array<[string, string]> = [
    ["Risk-free rate", fmtPct(a.riskFree ?? 0, 2)],
    ["Levered beta", (a.leveredBeta ?? 0).toFixed(2)],
    ["Equity risk premium", fmtPct(a.erp ?? 0, 2)],
    ["Beta × ERP", fmtPct((a.leveredBeta ?? 0) * (a.erp ?? 0), 2)],
    ["Small-stock premium", fmtPct(a.smallStockPremium, 2)],
    ["Company-specific premium", fmtPct(a.companySpecificPremium, 2)],
  ];

  const totalCap = inputs.longTermDebt + inputs.totalEquity;
  const weighted: Array<[string, string, string]> = [
    [
      "Equity",
      fmtPct(wacc.weightEquity, 1),
      `${fmtMoney(inputs.totalEquity)} of ${fmtMoney(totalCap)}`,
    ],
    [
      "Debt (LT only)",
      fmtPct(wacc.weightDebt, 1),
      `${fmtMoney(inputs.longTermDebt)} of ${fmtMoney(totalCap)}`,
    ],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Cost of equity (CAPM)" subtitle="Rf + β × ERP + size + company-specific">
        <dl className="divide-y divide-border">
          {capm.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2 text-sm">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular font-medium text-ink">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between border-t-2 border-ink py-3 text-sm">
            <dt className="font-semibold text-ink">Cost of equity</dt>
            <dd className="tabular text-base font-semibold text-ink">
              {fmtPct(wacc.costOfEquity, 2)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Weighted-average cost of capital" subtitle={`Using ${inputs.bridgeYear} capital structure`}>
        <dl className="space-y-2">
          {weighted.map(([k, w, sub]) => (
            <div key={k} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <dt className="font-medium text-ink">{k}</dt>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <dd className="tabular font-medium text-ink">{w}</dd>
            </div>
          ))}
          <div className="my-2 h-px bg-border" />
          <div className="flex items-center justify-between py-1 text-sm">
            <dt className="text-muted-foreground">After-tax cost of debt</dt>
            <dd className="tabular font-medium text-ink">{fmtPct(wacc.afterTaxCostOfDebt, 2)}</dd>
          </div>
          <div className="flex items-center justify-between py-1 text-sm">
            <dt className="text-muted-foreground">WACC (precise)</dt>
            <dd className="tabular font-medium text-ink">{fmtPct(wacc.waccPrecise, 2)}</dd>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-ink px-3 py-3 text-primary-foreground">
            <dt className="text-sm font-semibold">WACC used (rounded)</dt>
            <dd className="tabular text-base font-semibold">{fmtPct(wacc.waccRounded, 2)}</dd>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Per model convention, WACC is rounded to two decimals before discounting.
          </p>
        </dl>
      </Card>
    </div>
  );
}
