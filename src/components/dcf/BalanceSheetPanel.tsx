import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { BalanceSheetSnapshot } from "@/lib/dcf/engine";
import { fmtMoney } from "@/lib/dcf/format";

// Collapsed-by-default card showing the latest-actual balance sheet the model
// uses. Lets the analyst verify the cash, debt and equity that feed the equity
// bridge and WACC weights — without adding scroll length until they open it.
export function BalanceSheetPanel({ snapshot }: { snapshot: BalanceSheetSnapshot }) {
  const [open, setOpen] = useState(false);
  const s = snapshot;

  type Line = { label: string; value: number; bold?: boolean; rule?: boolean; highlight?: boolean };
  const assets: Line[] = [
    { label: "Cash & equivalents", value: s.cash, highlight: true },
    { label: "Current assets", value: s.currentAssets },
    { label: "Non-current assets", value: s.nonCurrentAssets },
    { label: "Total assets", value: s.totalAssets, bold: true, rule: true },
  ];
  const liabEquity: Line[] = [
    { label: "Short-term debt", value: s.shortTermDebt },
    { label: "Long-term debt", value: s.longTermDebt },
    { label: "Total liabilities", value: s.totalLiabilities, bold: true, rule: true },
    { label: "Common stock", value: s.commonStock },
    { label: "Series Seed", value: s.seriesSeed },
    { label: "Series A", value: s.seriesA },
    { label: "Retained earnings", value: s.retainedEarnings },
    { label: "Total equity", value: s.totalEquity, bold: true, rule: true, highlight: true },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div>
          <h3 className="font-serif text-base font-semibold text-ink">
            Balance sheet — FY{s.year}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {open ? "Latest actuals from the report · in $ millions" : "Verify cash, debt & equity used in the bridge"}
          </p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border p-6">
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            <Column title="Assets" lines={assets} />
            <Column title="Liabilities & equity" lines={liabEquity} />
          </div>
          <p className="mt-5 rounded-lg bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-ink">Cash</span>, debt and{" "}
            <span className="font-medium text-ink">total equity</span> feed the equity bridge and
            the WACC weights. Highlighted figures are what the model uses.
          </p>
        </div>
      )}
    </section>
  );
}

function Column({ title, lines }: { title: string; lines: Array<{ label: string; value: number; bold?: boolean; rule?: boolean; highlight?: boolean }> }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <dl className="space-y-1.5">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`flex items-center justify-between text-sm ${
              l.rule ? "border-t border-border pt-2" : ""
            } ${l.highlight ? "text-accent" : l.bold ? "text-ink" : "text-foreground"}`}
          >
            <dt className={l.bold || l.highlight ? "font-semibold" : ""}>{l.label}</dt>
            <dd className={`tabular ${l.bold || l.highlight ? "font-semibold" : ""}`}>
              {fmtMoney(l.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
