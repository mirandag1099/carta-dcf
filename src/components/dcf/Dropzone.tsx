import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { buildSampleInputs } from "@/lib/dcf/parser";
import { extractFinancialsFromPdf } from "@/lib/dcf/extractFromPdf.functions";
import { HeroBackground } from "./HeroBackground";
import type { HistoricalYear, ParsedInputs } from "@/lib/dcf/engine";
import type { ValidationCheck } from "@/lib/dcf/validate";

export interface LoadedResult {
  inputs: ParsedInputs;
  companyName: string | null;
  warnings: string[];
  validation: ValidationCheck[];
  historical: HistoricalYear[];
}

interface Props {
  onLoaded: (result: LoadedResult) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function Dropzone({ onLoaded }: Props) {
  const extract = useServerFn(extractFinancialsFromPdf);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setWarnings([]);
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a .pdf file.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("PDF is larger than 20 MB. Please upload a smaller file.");
        return;
      }
      setBusy(true);
      try {
        setStage("Reading PDF…");
        const pdfBase64 = await fileToBase64(file);
        setStage("Scanning pages & extracting financials…");
        const result = await extract({ data: { pdfBase64, fileName: file.name } });
        setWarnings(result.warnings ?? []);
        onLoaded({
          inputs: result.inputs,
          companyName: result.companyName ?? null,
          warnings: result.warnings ?? [],
          validation: result.validation ?? [],
          historical: result.historical ?? [],
        });
      } catch (e) {
        setError((e as Error).message || "Extraction failed.");
      } finally {
        setBusy(false);
        setStage("");
      }
    },
    [extract, onLoaded],
  );

  return (
    <div className="relative isolate min-h-[calc(100vh-64px)] overflow-hidden bg-[#1a1a1a]">
      <HeroBackground />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col items-center justify-center px-6 py-16">
        <div className="text-center">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ee835f]" />
            Automated ingestion — drop an annual report, get a full DCF
          </p>
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-white md:text-6xl">
            From financial statements to{" "}
            <span className="text-[#ee835f]">valuation</span>, in seconds.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-white/60">
            Drop an annual report PDF. The app reads every page, extracts the income
            statement and balance sheet, and feeds them straight into a live DCF you can
            tweak in real time.
          </p>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`mt-10 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 backdrop-blur-sm transition-colors ${
            dragOver ? "border-[#ee835f] bg-[#ee835f]/10" : "border-white/20 bg-white/[0.04] hover:border-white/40"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ee835f] text-[#1a1a1a]">
            <Upload className="h-5 w-5" />
          </div>
          <p className="mt-4 text-base font-medium text-white">Drop an annual report PDF here</p>
          <p className="mt-1 text-sm text-white/50">up to 20 MB · statements extracted automatically</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="rounded-lg bg-[#ee835f] text-[#1a1a1a] hover:bg-[#ee835f]/90"
              disabled={busy}
            >
              <span>
                <FileText className="mr-2 h-4 w-4" />
                Choose PDF
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onLoaded({
                  inputs: buildSampleInputs(),
                  companyName: null,
                  warnings: [],
                  validation: [],
                  historical: [],
                });
              }}
            >
              Try sample data
            </Button>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {busy && (
            <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              {stage || "Working…"}
            </p>
          )}
        </label>

        {error && (
          <div className="mt-6 w-full rounded-xl border border-red-400/40 bg-red-500/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-6 w-full rounded-xl border border-amber-400/40 bg-amber-500/10 p-5 backdrop-blur-sm">
            <p className="text-sm font-medium text-amber-300">
              Extracted with {warnings.length} note{warnings.length === 1 ? "" : "s"} — review in the sidebar:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/60">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
