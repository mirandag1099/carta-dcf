import type { DcfOutput, MethodResult, ParsedInputs } from "@/lib/dcf/engine";
import { fmtMoney } from "@/lib/dcf/format";
import { Card } from "./ForecastTable";
import { Locked } from "./Locked";

export function DcfComparison({
  output,
  inputs,
}: {
  output: DcfOutput;
  inputs: ParsedInputs;
}) {
  if (!output.perpetuity || !output.exitMultiple || !output.wacc) {
    return (
      <Locked
        title="DCF — terminal value comparison"
        subtitle="Perpetuity growth vs. exit multiple"
      />
    );
  }
  return (
    <Card
      title="DCF — terminal value comparison"
      subtitle="Perpetuity growth vs. exit multiple"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <MethodCard r={output.perpetuity} bridge={inputs.bridgeYear} />
        <MethodCard r={output.exitMultiple} bridge={inputs.bridgeYear} />
      </div>
      <p className="mt-5 rounded-lg bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {output.perpetuity.tvDiscountYears === output.exitMultiple.tvDiscountYears ? (
          <>
            Both terminal values are discounted {output.perpetuity.tvDiscountYears} years to the
            valuation date; the methods differ only in how the terminal value itself is estimated —
            a perpetuity growth of the final-year free cash flow versus a revenue exit multiple.
          </>
        ) : (
          <>
            The two methods diverge because the perpetuity terminal value is discounted one period
            further ({output.perpetuity.tvDiscountYears} yrs vs. {output.exitMultiple.tvDiscountYears}{" "}
            yrs).
          </>
        )}{" "}
        Both methods use {inputs.bridgeYear} cash and debt for the equity bridge, and WACC is
        rounded to{" "}
        <span className="font-medium text-ink">
          {(output.wacc.waccRounded * 100).toFixed(0)}%
        </span>{" "}
        before discounting.
      </p>
    </Card>
  );
}

function MethodCard({
  r,
  bridge,
}: {
  r: MethodResult;
  bridge: number;
}) {
  const lines: Array<{ k: string; v: string; em?: boolean; minus?: boolean }> = [
    { k: "Terminal value (FV)", v: fmtMoney(r.tvFV) },
    { k: `Terminal value (PV @ ${r.tvDiscountYears}y)`, v: fmtMoney(r.tvPV) },
    { k: "+ PV of explicit FCFF", v: fmtMoney(r.pvExplicit) },
    { k: "Enterprise value", v: fmtMoney(r.enterpriseValue), em: true },
    { k: `+ Cash (${bridge})`, v: fmtMoney(r.cash) },
    { k: `− Debt (${bridge})`, v: fmtMoney(r.debt), minus: true },
  ];
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {r.label}
      </p>
      <dl className="mt-3 space-y-1.5">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`flex items-center justify-between text-sm ${
              l.em ? "border-t border-border pt-2 font-semibold text-ink" : "text-foreground"
            }`}
          >
            <dt>{l.k}</dt>
            <dd className="tabular">{l.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-lg bg-ink px-4 py-3 text-primary-foreground">
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
          Equity value
        </p>
        <p className="tabular mt-1 text-2xl font-semibold">{fmtMoney(r.equityValue)}</p>
      </div>
    </div>
  );
}
