import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { EmptyState } from "../ui/primitives";
import { money } from "../lib/text";
export interface ChartPoint {
  name: string;
  value: number;
  secondary?: number;
}
export type ChartKind =
  "line" | "area" | "bar" | "horizontal-bar" | "pie" | "donut" | "multi-series" | "sparkline";
const colors = ["#687b6b", "#c7ad85", "#8d9aaa", "#a192aa", "#b4b4a6"];
export default function Chart({
  data,
  kind = "area",
  label,
  unit,
}: {
  data: ChartPoint[];
  kind?: ChartKind;
  label: string;
  unit?: "VND" | "quantity";
}) {
  if (!data.length) return <EmptyState title="Chưa có dữ liệu trong khoảng thời gian này" />;
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--a-border)" />
      <XAxis
        dataKey="name"
        axisLine={false}
        tickLine={false}
        fontSize={10}
        tick={{ fill: "var(--a-muted)" }}
        minTickGap={20}
      />
      <YAxis
        axisLine={false}
        tickLine={false}
        width={42}
        fontSize={10}
        tick={{ fill: "var(--a-muted)" }}
      />
      <Tooltip
        contentStyle={{
          background: "var(--a-surface)",
          border: "1px solid var(--a-border)",
          borderRadius: 6,
          fontSize: 11,
          color: "var(--a-text)",
        }}
      />
    </>
  );
  return (
    <figure style={{ margin: 0 }} aria-label={label}>
      <div className="a-chart">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "horizontal-bar" ? (
            <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid horizontal={false} stroke="var(--a-border)" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                fontSize={10}
                tick={{ fill: "var(--a-muted)" }}
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat("vi-VN", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(v)
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                axisLine={false}
                tickLine={false}
                fontSize={10}
                tick={{ fill: "var(--a-muted)" }}
                tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)}
              />
              <Tooltip
                formatter={(v) =>
                  unit === "VND" ? money(Number(v)) : Number(v).toLocaleString("vi-VN")
                }
                contentStyle={{
                  background: "var(--a-surface)",
                  border: "1px solid var(--a-border)",
                  color: "var(--a-text)",
                  fontSize: 11,
                }}
              />
              <Bar
                dataKey="value"
                name={unit === "VND" ? "Giá trị (VND)" : "Số lượng"}
                fill={colors[0]}
                radius={[0, 3, 3, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : kind === "pie" || kind === "donut" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={kind === "donut" ? "55%" : 0}
                outerRadius="80%"
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          ) : kind === "bar" ? (
            <BarChart data={data}>
              {axes}
              <Bar
                dataKey="value"
                name="Số lượng"
                fill={colors[0]}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : kind === "line" || kind === "multi-series" || kind === "sparkline" ? (
            <LineChart data={data}>
              {kind !== "sparkline" && axes}
              <Line
                dataKey="value"
                name="Giá trị"
                type="monotone"
                stroke={colors[0]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {kind === "multi-series" && (
                <Line
                  dataKey="secondary"
                  name="Kỳ trước"
                  stroke={colors[1]}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          ) : (
            <AreaChart data={data}>
              {axes}
              <Area
                type="monotone"
                dataKey="value"
                name="Giá trị"
                stroke={colors[0]}
                fill={colors[0]}
                fillOpacity={0.08}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption className="a-chart-summary">
        {label} · {data.length} nhóm · Tổng{" "}
        {unit === "VND"
          ? money(data.reduce((n, p) => n + p.value, 0))
          : data.reduce((n, p) => n + p.value, 0).toLocaleString("vi-VN")}{" "}
        (demo)
      </figcaption>
    </figure>
  );
}
