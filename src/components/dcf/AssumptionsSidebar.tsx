import { useMemo } from "react";
import type { Assumptions, ParsedInputs, DcfOutput } from "@/lib/dcf/engine";
import { fmtPct } from "@/lib/dcf/format";

interface Props {
  inputs: ParsedInputs;
  assumptions: Assumptions;
  setAssumptions: (a: Assumptions) => void;
  output: DcfOutput;
}

type Field = {
  key: keyof Assumptions;
  label: string;
  kind: "pct" | "num";
  step?: number;
};

const IS_FIELDS: Field[] = [
  { key: "revenueGrowth", label: "Revenue growth", kind: "pct" },
  { key: "gpMargin", label: "Gross margin", kind: "pct" },
  { key: "operatingMargin", label: "Operating margin", kind: "pct" },
  { key: "ebitdaMargin", label: "EBITDA margin", kind: "pct" },
  { key: "capexPctRevenue", label: "CapEx % of revenue", kind: "pct" },
  { key: "nwcPctRevenue", label: "ΔNWC % of revenue", kind: "pct" },
];

const WACC_FIELDS: Field[] = [
  { key: "taxRate", label: "Tax rate", kind: "pct" },
  { key: "leveredBeta", label: "Levered beta", kind: "num", step: 0.01 },
  { key: "riskFree", label: "Risk-free rate", kind: "pct" },
  { key: "erp", label: "Equity risk premium", kind: "pct" },
  { key: "smallStockPremium", label: "Small-stock premium", kind: "pct" },
  { key: "companySpecificPremium", label: "Company-specific premium", kind: "pct" },
  { key: "pretaxCostOfDebt", label: "Pre-tax cost of debt", kind: "pct" },
];

const DCF_FIELDS: Field[] = [
  { key: "terminalGrowth", label: "Terminal growth rate", kind: "pct" },
  { key: "terminalMultiple", label: "Terminal exit multiple (×Rev)", kind: "num", step: 0.1 },
];

function Row({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const display =
    value == null ? "" : field.kind === "pct" ? (value * 100).toFixed(2) : value.toString();
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{field.label}</span>
      <div className="relative">
        <input
          type="number"
          step={field.kind === "pct" ? 0.1 : field.step ?? 0.01}
          placeholder="—"
          defaultValue={display}
          onBlur={(e) => {
            const raw = parseFloat(e.target.value);
            if (!Number.isFinite(raw)) return;
            const v = field.kind === "pct" ? raw / 100 : raw;
            onChange(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="tabular w-24 rounded-md border border-input bg-surface px-2 py-1 pr-6 text-right text-sm text-ink outline-none ring-ring focus:border-ring focus:ring-2"
        />
        {field.kind === "pct" && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </span>
        )}
      </div>
    </label>
  );
}

export function AssumptionsSidebar({ inputs, assumptions, setAssumptions, output }: Props) {
  const update = (k: keyof Assumptions, v: number) =>
    setAssumptions({ ...assumptions, [k]: v });

  const derived = useMemo(() => {
    const w = output.wacc;
    const { ebitdaMargin, operatingMargin } = assumptions;
    const daMargin =
      ebitdaMargin != null && operatingMargin != null ? fmtPct(ebitdaMargin - operatingMargin, 2) : "—";
    return [
      ["Implied D&A margin", daMargin],
      ["Cost of equity (CAPM)", w ? fmtPct(w.costOfEquity, 2) : "—"],
      ["After-tax cost of debt", w ? fmtPct(w.afterTaxCostOfDebt, 2) : "—"],
      ["WACC (precise)", w ? fmtPct(w.waccPrecise, 2) : "—"],
      ["WACC used (rounded)", w ? fmtPct(w.waccRounded, 2) : "—"],
    ];
  }, [output.wacc, assumptions]);

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 shrink-0 overflow-y-auto border-r border-border bg-surface lg:block">
      <div className="px-5 py-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Assumptions
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your forecast and WACC assumptions — the dashboard builds once
          they're in, and recalculates instantly as you edit.
        </p>
      </div>

      <Section title="Income statement">
        {IS_FIELDS.map((f) => (
          <Row key={f.key} field={f} value={assumptions[f.key]} onChange={(v) => update(f.key, v)} />
        ))}
      </Section>

      <Section title="WACC components">
        {WACC_FIELDS.map((f) => (
          <Row key={f.key} field={f} value={assumptions[f.key]} onChange={(v) => update(f.key, v)} />
        ))}
      </Section>

      <Section title="DCF terminal">
        {DCF_FIELDS.map((f) => (
          <Row key={f.key} field={f} value={assumptions[f.key]} onChange={(v) => update(f.key, v)} />
        ))}
      </Section>

      <Section title="Derived">
        <div className="space-y-1.5">
          {derived.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{k}</span>
              <span className="tabular font-medium text-ink">{v}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Balance sheet (${inputs.bridgeYear})`}>
        <div className="space-y-1.5 text-xs">
          <BsRow label="Cash" value={inputs.cash} />
          <BsRow label="Short-term debt" value={inputs.shortTermDebt} />
          <BsRow label="Long-term debt" value={inputs.longTermDebt} />
          <BsRow label="Total equity" value={inputs.totalEquity} />
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border px-5 py-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink">{title}</h3>
      {children}
    </div>
  );
}

function BsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium text-ink">${value.toFixed(2)}M</span>
    </div>
  );
}
