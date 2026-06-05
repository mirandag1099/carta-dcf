import { useMemo } from "react";
import { sensitivityGrid, type Assumptions, type ParsedInputs, type DcfOutput } from "@/lib/dcf/engine";
import { fmtPct } from "@/lib/dcf/format";
import { Card } from "./ForecastTable";
import { Locked } from "./Locked";

export function Sensitivity({
  inputs,
  assumptions,
  output,
}: {
  inputs: ParsedInputs;
  assumptions: Assumptions;
  output: DcfOutput;
}) {
  const waccRounded = output.wacc?.waccRounded ?? null;
  const grid = useMemo(
    () => (waccRounded != null ? sensitivityGrid(inputs, assumptions, waccRounded) : null),
    [inputs, assumptions, waccRounded],
  );

  if (!grid || !output.perpetuity) {
    return (
      <Locked
        title="Sensitivity — perpetuity equity value"
        subtitle="WACC (rows) × terminal growth (columns), $M"
      />
    );
  }

  const flat = grid.values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const baseline = output.perpetuity.equityValue;

  function bg(v: number): string {
    if (max === min) return "transparent";
    const t = (v - min) / (max - min); // 0..1
    // monochrome scale: light gray -> ink
    const lightness = 96 - t * 30; // 96 -> 66
    return `hsl(220 12% ${lightness}%)`;
  }

  return (
    <Card
      title="Sensitivity — perpetuity equity value"
      subtitle="WACC (rows) × terminal growth (columns), $M"
    >
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th className="border-b border-border py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                WACC ↓ / g →
              </th>
              {grid.growths.map((g) => (
                <th
                  key={g}
                  className="tabular border-b border-border px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {fmtPct(g, 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.values.map((row, i) => (
              <tr key={i}>
                <td className="tabular border-b border-border py-2 pr-3 text-left font-medium text-ink">
                  {fmtPct(grid.waccs[i], 0)}
                </td>
                {row.map((v, j) => {
                  const isBase = Math.abs(v - baseline) < 0.01;
                  return (
                    <td
                      key={j}
                      style={{ background: bg(v) }}
                      className={`tabular border-b border-border px-3 py-2 text-right ${
                        isBase ? "outline outline-2 -outline-offset-2 outline-accent font-semibold" : ""
                      }`}
                    >
                      ${v.toFixed(1)}M
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
