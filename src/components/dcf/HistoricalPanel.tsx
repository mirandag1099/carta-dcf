import type { HistoricalYear } from "@/lib/dcf/engine";
import { fmtMoney, fmtPct } from "@/lib/dcf/format";
import { Card } from "./ForecastTable";

// Read-only historical income statement extracted from the report's actuals.
// Gives the analyst a basis to choose forecast assumptions ("here's the
// history, now project it") while the forecast stays locked.
export function HistoricalPanel({ historical }: { historical: HistoricalYear[] }) {
  if (!historical || historical.length === 0) return null;
  const years = historical.map((h) => h.year);

  const rows: Array<{
    label: string;
    values: string[];
    bold?: boolean;
    muted?: boolean;
    rule?: boolean;
  }> = [
    { label: "Revenue", values: historical.map((h) => fmtMoney(h.revenue)), bold: true },
    { label: "Revenue growth", values: historical.map((h, i) => (i === 0 ? "—" : fmtPct(h.revenue / historical[i - 1].revenue - 1, 1))), muted: true },
    { label: "COGS", values: historical.map((h) => fmtMoney(-h.cogs)) },
    { label: "Gross profit", values: historical.map((h) => fmtMoney(h.grossProfit)), bold: true, rule: true },
    { label: "Gross margin", values: historical.map((h) => fmtPct(h.revenue ? h.grossProfit / h.revenue : 0, 1)), muted: true },
    { label: "Operating expense", values: historical.map((h) => fmtMoney(-h.operatingExpense)) },
    { label: "Operating income", values: historical.map((h) => fmtMoney(h.operatingIncome)), bold: true, rule: true },
    { label: "Operating margin", values: historical.map((h) => fmtPct(h.revenue ? h.operatingIncome / h.revenue : 0, 1)), muted: true },
    { label: "+ D&A", values: historical.map((h) => fmtMoney(h.da)) },
    { label: "EBITDA", values: historical.map((h) => fmtMoney(h.ebitda)), bold: true, rule: true },
    { label: "EBITDA margin", values: historical.map((h) => fmtPct(h.revenue ? h.ebitda / h.revenue : 0, 1)), muted: true },
    { label: "− Tax", values: historical.map((h) => fmtMoney(-h.tax)) },
    { label: "Net income", values: historical.map((h) => fmtMoney(h.netIncome)), bold: true, rule: true },
    { label: "CapEx", values: historical.map((h) => fmtMoney(h.capex)) },
    { label: "CapEx % of revenue", values: historical.map((h) => fmtPct(h.revenue ? h.capex / h.revenue : 0, 1)), muted: true },
    { label: "Change in NWC", values: historical.map((h) => fmtMoney(h.changeNwc)) },
    { label: "ΔNWC % of revenue", values: historical.map((h) => fmtPct(h.revenue ? h.changeNwc / h.revenue : 0, 1)), muted: true },
  ];

  return (
    <Card
      title="Historical income statement"
      subtitle={`Actuals from the report · ${years[0]}–${years.at(-1)} · in $ millions`}
    >
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4 text-left font-medium">Line item</th>
              {years.map((y, i) => (
                <th key={y} className="tabular py-2 pl-4 text-right font-medium">
                  {y}
                  {i === years.length - 1 ? <span className="ml-1 text-muted-foreground">·A</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={`${r.rule ? "border-t border-border" : ""} ${r.muted ? "text-muted-foreground" : "text-ink"}`}
              >
                <td className={`py-1.5 pr-4 ${r.bold ? "font-semibold" : ""}`}>{r.label}</td>
                {r.values.map((v, j) => (
                  <td key={j} className={`tabular py-1.5 pl-4 text-right ${r.bold ? "font-semibold" : ""}`}>
                    {v}
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
