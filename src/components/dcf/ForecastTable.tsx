import type { DcfOutput, ParsedInputs } from "@/lib/dcf/engine";
import { fmtMoney, fmtPct } from "@/lib/dcf/format";
import { Locked } from "./Locked";

export function ForecastTable({
  output,
  inputs,
}: {
  output: DcfOutput;
  inputs: ParsedInputs;
}) {
  if (output.periods.length === 0) {
    return (
      <Locked
        title="Forecast income statement & free cash flow"
        subtitle={`Anchor ${inputs.anchorYear} · in $ millions`}
        message="Enter your forecast assumptions — revenue growth, gross / operating / EBITDA margins, CapEx % and ΔNWC % — in the sidebar to build the forecast."
      />
    );
  }
  const rows = output.periods;
  const cols = rows.map((r) => r.year);

  const lines: Array<{
    label: string;
    values: Array<number | null>;
    fmt: "money" | "pct";
    bold?: boolean;
    rule?: "top" | "bottom";
    muted?: boolean;
  }> = [
    { label: "Revenue", values: rows.map((r) => r.revenue), fmt: "money", bold: true },
    { label: "Growth %", values: rows.map((r) => r.growth), fmt: "pct", muted: true },
    { label: "COGS", values: rows.map((r) => -r.cogs), fmt: "money" },
    { label: "Gross profit", values: rows.map((r) => r.grossProfit), fmt: "money", bold: true, rule: "top" },
    { label: "GP margin", values: rows.map((r) => r.gpMargin), fmt: "pct", muted: true },
    { label: "Operating expense", values: rows.map((r) => -r.opex), fmt: "money" },
    { label: "Operating income", values: rows.map((r) => r.operatingIncome), fmt: "money", bold: true, rule: "top" },
    { label: "+ D&A", values: rows.map((r) => r.da), fmt: "money" },
    { label: "EBITDA", values: rows.map((r) => r.ebitda), fmt: "money", bold: true, rule: "top" },
    { label: "− D&A", values: rows.map((r) => -r.da), fmt: "money" },
    { label: "EBIT", values: rows.map((r) => r.ebit), fmt: "money", bold: true, rule: "top" },
    { label: "− Tax", values: rows.map((r) => -r.tax), fmt: "money" },
    { label: "NOPAT", values: rows.map((r) => r.nopat), fmt: "money", bold: true, rule: "top" },
    { label: "+ D&A", values: rows.map((r) => r.da), fmt: "money" },
    { label: "− CapEx", values: rows.map((r) => -r.capex), fmt: "money" },
    { label: "− ΔNWC", values: rows.map((r) => -r.changeNwc), fmt: "money" },
    { label: "FCFF", values: rows.map((r) => r.fcff), fmt: "money", bold: true, rule: "top" },
    { label: "Discount period (yrs)", values: rows.map((r) => r.discountPeriod), fmt: "money", muted: true },
    { label: "PV of FCFF", values: rows.map((r) => r.pvFcff), fmt: "money", bold: true, rule: "top" },
  ];

  function format(v: number | null, fmt: "money" | "pct", label: string) {
    if (v === null) return "—";
    if (label === "Discount period (yrs)") return v.toFixed(1);
    return fmt === "money" ? fmtMoney(v) : fmtPct(v, 1);
  }

  return (
    <Card title="Forecast income statement & free cash flow" subtitle={`Anchor ${inputs.anchorYear} · in $ millions`}>
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4 text-left font-medium">Line item</th>
              {cols.map((y, i) => (
                <th key={y} className={`tabular py-2 pl-4 text-right font-medium ${i === 0 ? "" : ""}`}>
                  {y}
                  {i === 0 ? <span className="ml-1 text-muted-foreground">·A</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr
                key={i}
                className={`${l.rule === "top" ? "border-t border-border" : ""} ${l.muted ? "text-muted-foreground" : "text-ink"}`}
              >
                <td className={`py-1.5 pr-4 ${l.bold ? "font-semibold" : ""}`}>{l.label}</td>
                {l.values.map((v, j) => (
                  <td key={j} className={`tabular py-1.5 pl-4 text-right ${l.bold ? "font-semibold" : ""}`}>
                    {format(v, l.fmt, l.label)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-surface ${className}`}>
      {(title || subtitle) && (
        <header className="flex items-baseline justify-between border-b border-border px-6 py-4">
          <div>
            {title && <h3 className="font-serif text-base font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
