import { lazy, Suspense } from "react";
import { Card, Skeleton, Tooltip, Button } from "../ui/primitives";
import { Info } from "lucide-react";
import { day, type DateRange, presetRange } from "../../analytics/aggregate";
import { useState } from "react";
import type { ChartPoint, ChartKind } from "./chart";
const Chart = lazy(() => import("./chart"));
export function ChartCard({
  title,
  data,
  kind = "area",
  unit,
}: {
  title: string;
  data: ChartPoint[];
  kind?: ChartKind;
  unit?: "VND" | "quantity";
}) {
  return (
    <Card>
      <div className="a-card-head">
        <h2>{title}</h2>
        <small>DEMO</small>
      </div>
      <Suspense fallback={<Skeleton rows={5} />}>
        <Chart data={data} kind={kind} label={title} unit={unit} />
      </Suspense>
    </Card>
  );
}
export function Kpi({
  title,
  value,
  previous,
  raw,
  description,
}: {
  title: string;
  value: string | number;
  previous?: number;
  raw?: number;
  description: string;
}) {
  const change =
    previous !== undefined && previous !== 0 && raw !== undefined
      ? ((raw - previous) / Math.abs(previous)) * 100
      : null;
  return (
    <Card>
      <div className="a-kpi-label">
        <span>{title}</span>
        <Tooltip label={description}>
          <Button size="sm" variant="ghost" aria-label={`Giải thích ${title}`}>
            <Info size={12} />
          </Button>
        </Tooltip>
      </div>
      <div className="a-kpi-value">{value}</div>
      <div className="a-kpi-change">
        {change === null ? (
          "—"
        ) : (
          <b>
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}%
          </b>
        )}{" "}
        so với kỳ trước · demo
      </div>
    </Card>
  );
}
export function DateFilter({
  value,
  onChange,
  resolvePreset = presetRange,
  caption = "Mốc dữ liệu demo:01/11/2026 · múi giờ Việt Nam",
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  resolvePreset?: (preset: string) => DateRange;
  caption?: string;
}) {
  const [preset, setPreset] = useState("30");
  const [start, setStart] = useState(day(value.start));
  const [end, setEnd] = useState(day(new Date(Date.parse(value.end) - 1).toISOString()));
  return (
    <div className="a-filter-dates">
      <select
        aria-label="Khoảng thời gian"
        value={preset}
        onChange={(e) => {
          const p = e.target.value;
          setPreset(p);
          if (p !== "custom") {
            const next = resolvePreset(p);
            onChange(next);
            setStart(day(next.start));
            setEnd(day(new Date(Date.parse(next.end) - 1).toISOString()));
          }
        }}
      >
        <option value="today">Hôm nay (demo)</option>
        <option value="yesterday">Hôm qua</option>
        <option value="7">7 ngày</option>
        <option value="30">30 ngày</option>
        <option value="custom">Tùy chọn</option>
      </select>
      {preset === "custom" && (
        <>
          <input
            type="date"
            aria-label="Từ ngày"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <input
            type="date"
            aria-label="Đến ngày"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!start || !end || start > end}
            onClick={() =>
              onChange({
                start: new Date(start + "T00:00:00+07:00").toISOString(),
                end: new Date(Date.parse(end + "T00:00:00+07:00") + 86400000).toISOString(),
              })
            }
          >
            Áp dụng
          </Button>
        </>
      )}
      <small>{caption}</small>
    </div>
  );
}
