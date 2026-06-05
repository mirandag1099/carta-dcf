import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Assumptions, DcfOutput, ParsedInputs } from "@/lib/dcf/engine";
import {
  overallStatus,
  runModelChecks,
  type CheckStatus,
  type ValidationCheck,
} from "@/lib/dcf/validate";
import { Card } from "./ForecastTable";

// Surfaces the data-quality checks so an analyst can see, before trusting the
// output, that the extracted statements tie out and the model is sound.
export function ValidationPanel({
  extractionChecks,
  inputs,
  assumptions,
  output,
}: {
  extractionChecks: ValidationCheck[];
  inputs: ParsedInputs;
  assumptions: Assumptions;
  output: DcfOutput;
}) {
  const modelChecks = runModelChecks(inputs, assumptions, output);
  const checks = [...extractionChecks, ...modelChecks];
  if (checks.length === 0) return null;

  const status = overallStatus(checks);
  const passed = checks.filter((c) => c.status === "pass").length;

  const badge: Record<CheckStatus, { text: string; cls: string }> = {
    pass: {
      text: "Validated — ready for review",
      cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    warn: {
      text: "Review recommended",
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    fail: {
      text: "Issues found",
      cls: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  };

  return (
    <Card
      title="Validation & data quality"
      subtitle={`${passed} of ${checks.length} checks passed · review before sending to a client`}
    >
      <div className="mb-4">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${badge[status].cls}`}
        >
          <StatusIcon status={status} />
          {badge[status].text}
        </span>
      </div>
      <ul className="space-y-2.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <StatusIcon status={c.status} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}
