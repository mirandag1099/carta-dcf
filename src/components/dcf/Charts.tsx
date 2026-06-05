import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DcfOutput } from "@/lib/dcf/engine";
import { Card } from "./ForecastTable";
import { Locked } from "./Locked";

const INK = "#1a1a1a"; // Carta black
const ORANGE = "#ee835f"; // Carta orange
const SLATE = "#6B7682";
const HAIR = "#E3E6E9";

export function Charts({ output }: { output: DcfOutput }) {
  const data = output.periods.map((p) => ({
    year: String(p.year),
    Revenue: round(p.revenue),
    FCFF: round(p.fcff),
  }));

  const compare =
    output.perpetuity && output.exitMultiple
      ? [
          { method: "Perpetuity", value: round(output.perpetuity.equityValue) },
          { method: "Exit multiple", value: round(output.exitMultiple.equityValue) },
        ]
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.length === 0 ? (
        <Locked
          title="Revenue vs. FCFF"
          subtitle="By forecast year ($M)"
          message="Enter your forecast assumptions in the sidebar to chart the projected revenue and free cash flow."
        />
      ) : (
        <Card title="Revenue vs. FCFF" subtitle="By forecast year ($M)">
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="year" stroke={SLATE} tickLine={false} axisLine={{ stroke: HAIR }} fontSize={12} />
              <YAxis stroke={SLATE} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                cursor={{ fill: "rgba(19,41,61,0.04)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${HAIR}`,
                  fontSize: 12,
                  background: "#fff",
                }}
              />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="Revenue" fill={INK} radius={[4, 4, 0, 0]} />
              <Bar dataKey="FCFF" fill={ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </Card>
      )}

      {!compare ? (
        <Locked title="Equity value by method" subtitle="Implied valuation ($M)" />
      ) : (
        <Card title="Equity value by method" subtitle="Implied valuation ($M)">
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={compare} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="method" stroke={SLATE} tickLine={false} axisLine={{ stroke: HAIR }} fontSize={12} />
              <YAxis stroke={SLATE} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                cursor={{ fill: "rgba(19,41,61,0.04)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${HAIR}`,
                  fontSize: 12,
                  background: "#fff",
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {compare.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? INK : ORANGE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        </Card>
      )}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
