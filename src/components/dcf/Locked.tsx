import { Lock } from "lucide-react";
import { Card } from "./ForecastTable";

// Empty state shown wherever a valuation output would go before the analyst has
// entered the WACC inputs. We deliberately don't fabricate a number here.
export function Locked({
  title,
  subtitle,
  message = "Enter the WACC inputs (risk-free rate, beta, ERP, pre-tax cost of debt) in the sidebar to compute the valuation.",
}: {
  title?: string;
  subtitle?: string;
  message?: string;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
          <Lock className="h-4 w-4" />
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </Card>
  );
}
