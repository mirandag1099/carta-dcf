import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { exportDashboardToPdf } from "@/lib/dcf/exportPdf";
import { Dropzone, type LoadedResult } from "@/components/dcf/Dropzone";
import { Header, KpiCards, MetaRow } from "@/components/dcf/Header";
import { AssumptionsSidebar } from "@/components/dcf/AssumptionsSidebar";
import { ValidationPanel } from "@/components/dcf/ValidationPanel";
import { HistoricalPanel } from "@/components/dcf/HistoricalPanel";
import { BalanceSheetPanel } from "@/components/dcf/BalanceSheetPanel";
import { ForecastTable } from "@/components/dcf/ForecastTable";
import { WaccBuildup } from "@/components/dcf/WaccBuildup";
import { DcfComparison } from "@/components/dcf/DcfComparison";
import { Charts } from "@/components/dcf/Charts";
import { Sensitivity } from "@/components/dcf/Sensitivity";
import {
  defaultAssumptions,
  runDcf,
  type Assumptions,
  type ParsedInputs,
} from "@/lib/dcf/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Carta DCF Valuation — Equity valuation, in seconds" },
      {
        name: "description",
        content:
          "Upload a financial template and get a polished DCF dashboard with editable assumptions, two terminal-value methods, and live sensitivity — all in the browser.",
      },
      { property: "og:title", content: "Carta DCF Valuation" },
      {
        property: "og:description",
        content:
          "In-browser discounted cash flow valuation with editable assumptions and sensitivity analysis.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [inputs, setInputs] = useState<ParsedInputs | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [meta, setMeta] = useState<LoadedResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleLoaded = (r: LoadedResult) => {
    setInputs(r.inputs);
    setAssumptions(defaultAssumptions(r.inputs));
    setMeta(r);
  };

  const output = useMemo(
    () => (inputs && assumptions ? runDcf(inputs, assumptions) : null),
    [inputs, assumptions],
  );

  const handleExport = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const name = inputs?.fileName?.replace(/\.[^.]+$/, "") || "valuation";
      await exportDashboardToPdf(
        reportRef.current,
        `carta-dcf-${name}.pdf`,
        `Carta DCF Valuation — ${inputs?.fileName ?? name}`,
      );
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  };

  if (!inputs || !assumptions || !output) {
    return (
      <div className="min-h-screen bg-[#1a1a1a]">
        <Header variant="dark" />
        <Dropzone onLoaded={handleLoaded} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        exporting={exporting}
        onExport={handleExport}
        onReset={() => {
          setInputs(null);
          setAssumptions(null);
          setMeta(null);
        }}
      />
      <div className="flex">
        <AssumptionsSidebar
          inputs={inputs}
          assumptions={assumptions}
          setAssumptions={setAssumptions}
          output={output}
        />
        <main
          ref={reportRef}
          className="min-w-0 flex-1 space-y-5 bg-background px-5 py-6 lg:px-8"
        >
          <div data-pdf-section>
            <MetaRow inputs={inputs} output={output} companyName={meta?.companyName ?? null} />
          </div>
          <div data-pdf-section>
            <ValidationPanel
              extractionChecks={meta?.validation ?? []}
              inputs={inputs}
              assumptions={assumptions}
              output={output}
            />
          </div>
          <div data-pdf-section>
            <KpiCards output={output} />
          </div>
          {meta?.historical && meta.historical.length > 0 && (
            <div data-pdf-section>
              <HistoricalPanel historical={meta.historical} />
            </div>
          )}
          {meta?.balanceSheet && (
            <BalanceSheetPanel snapshot={meta.balanceSheet} />
          )}
          <div data-pdf-section>
            <ForecastTable output={output} inputs={inputs} />
          </div>
          <div data-pdf-section>
            <WaccBuildup output={output} assumptions={assumptions} inputs={inputs} />
          </div>
          <div data-pdf-section>
            <DcfComparison output={output} inputs={inputs} />
          </div>
          <div data-pdf-section>
            <Charts output={output} />
          </div>
          <div data-pdf-section>
            <Sensitivity inputs={inputs} assumptions={assumptions} output={output} />
          </div>
          <p data-pdf-section className="pb-8 pt-2 text-center text-xs text-muted-foreground">
            All figures in $ millions. Computed entirely in your browser.
          </p>
        </main>
      </div>
    </div>
  );
}
