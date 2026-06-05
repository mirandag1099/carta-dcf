import { Button } from "@/components/ui/button";
import type { DcfOutput, ParsedInputs } from "@/lib/dcf/engine";
import { fmtMoney } from "@/lib/dcf/format";
import { Locked } from "./Locked";

export function Header({
  onReset,
  onExport,
  exporting,
  variant = "light",
}: {
  onReset?: () => void;
  onExport?: () => void;
  exporting?: boolean;
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  return (
    <header
      className={`sticky top-0 z-30 ${
        dark
          ? "bg-[#1a1a1a]"
          : "border-b border-border bg-surface/85 backdrop-blur"
      }`}
    >
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <Wordmark dark={dark} />
          <span className={`hidden h-5 w-px sm:block ${dark ? "bg-white/15" : "bg-border"}`} />
          <span
            className={`hidden text-sm font-medium sm:block ${
              dark ? "text-white/60" : "text-muted-foreground"
            }`}
          >
            DCF Valuation
          </span>
        </div>
        {(onReset || onExport) && (
          <div className="flex items-center gap-2">
            {onExport && (
              <Button
                variant="default"
                className="rounded-lg"
                onClick={onExport}
                disabled={exporting}
              >
                {exporting ? "Exporting…" : "Export PDF"}
              </Button>
            )}
            {onReset && (
              <Button variant="outline" className="rounded-lg" onClick={onReset}>
                New valuation
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <img
      src={dark ? "/carta-logo-light.svg" : "/carta-logo.png"}
      alt="Carta"
      className="h-8 w-auto"
    />
  );
}

export function MetaRow({
  inputs,
  output,
  companyName,
}: {
  inputs: ParsedInputs;
  output: DcfOutput;
  companyName?: string | null;
}) {
  const meta: Array<[string, string]> = [
    ...(companyName ? ([["Company", companyName]] as Array<[string, string]>) : []),
    ["File", inputs.fileName],
    ["Valuation date", inputs.valuationDate || "—"],
    ["Anchor year", String(inputs.anchorYear)],
    ["Forecast", `${inputs.forecastYears[0]}–${inputs.forecastYears.at(-1)}`],
    ["WACC used", output.wacc ? `${(output.wacc.waccRounded * 100).toFixed(0)}%` : "—"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-border bg-surface px-6 py-4">
      {meta.map(([k, v]) => (
        <div key={k}>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k}</p>
          <p className="tabular mt-0.5 text-sm font-medium text-ink">{v}</p>
        </div>
      ))}
    </div>
  );
}

export function KpiCards({ output }: { output: DcfOutput }) {
  if (!output.perpetuity || !output.exitMultiple) {
    return (
      <Locked
        title="Equity value"
        subtitle="Perpetuity growth · exit multiple"
        message="No valuation yet — enter the WACC inputs (risk-free rate, beta, ERP, pre-tax cost of debt) in the sidebar and the equity value will appear here."
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Kpi
        primary
        label="Equity value — perpetuity growth"
        value={output.perpetuity.equityValue}
        ev={output.perpetuity.enterpriseValue}
        cash={output.perpetuity.cash}
        debt={output.perpetuity.debt}
      />
      <Kpi
        label="Equity value — exit multiple"
        value={output.exitMultiple.equityValue}
        ev={output.exitMultiple.enterpriseValue}
        cash={output.exitMultiple.cash}
        debt={output.exitMultiple.debt}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  ev,
  cash,
  debt,
  primary = false,
}: {
  label: string;
  value: number;
  ev: number;
  cash: number;
  debt: number;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        primary
          ? "border-ink bg-ink text-primary-foreground"
          : "border-border bg-surface text-ink"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-wider ${
          primary ? "text-primary-foreground/60" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p className="tabular mt-2 text-4xl font-semibold tracking-tight">
        {fmtMoney(value)}
      </p>
      <p
        className={`tabular mt-3 text-xs ${
          primary ? "text-primary-foreground/65" : "text-muted-foreground"
        }`}
      >
        EV {fmtMoney(ev)} <span className="opacity-50">·</span> + Cash {fmtMoney(cash)}{" "}
        <span className="opacity-50">·</span> − Debt {fmtMoney(debt)}
      </p>
    </div>
  );
}
