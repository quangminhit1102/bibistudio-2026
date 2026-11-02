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
  reference?: string;
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
      {kind === "horizontal-bar" && (
        <ol className="a-chart-ranking" aria-label={label}>
          {data.map((p, i) => (
            <li key={p.reference ?? i}>
              <div>
                <span>{p.name}</span>
                {p.reference && <small>{p.reference}</small>}
              </div>
              <strong>{unit === "VND" ? money(p.value) : p.value.toLocaleString("vi-VN")}</strong>
              <span className="a-rank-track">
                <span
                  style={{
                    width: `${(Math.max(0, p.value) / (Math.max(...data.map((d) => d.value)) || 1)) * 100}%`,
                  }}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
      <div
        className={`a-chart ${kind === "horizontal-bar" ? "a-chart-horizontal" : ""}`}
        style={
          kind === "horizontal-bar" ? { height: Math.max(260, data.length * 48 + 36) } : undefined
        }
      >
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
                width={180}
                axisLine={false}
                tickLine={false}
                fontSize={10}
                tick={(props) => {
                  const item = data[props.index ?? 0];
                  return (
                    <foreignObject x={4} y={Number(props.y) - 19} width={168} height={42}>
                      <div
                        className="a-chart-tick"
                        tabIndex={0}
                        title={[item?.name, item?.reference].filter(Boolean).join(" · ")}
                      >
                        <span>{item?.name}</span>
                        <small>{item?.reference}</small>
                      </div>
                    </foreignObject>
                  );
                }}
              />
              <Tooltip
                labelFormatter={(_label, payload) => {
                  const item = payload?.[0]?.payload as ChartPoint | undefined;
                  return [item?.name, item?.reference].filter(Boolean).join(" · ");
                }}
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
      </figcaption>
    </figure>
  );
}
