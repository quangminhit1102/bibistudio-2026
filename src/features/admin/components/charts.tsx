import { useState } from "react";
import Chart from "../shared/charts/chart";
import type { ChartKind } from "../shared/charts/chart";
import { Button, Skeleton } from "../shared/ui/primitives";
import { Example } from "./example";
import { componentCatalogue } from "./catalogue";
const kinds: ChartKind[] = ["line", "area", "bar", "pie", "donut", "multi-series", "sparkline"];
const points = [
  { name: "T2", value: 15, secondary: 8 },
  { name: "T3", value: 32, secondary: 19 },
  { name: "T4", value: 24, secondary: 16 },
  { name: "T5", value: 41, secondary: 28 },
  { name: "T6", value: 35, secondary: 24 },
];
function ChartExample({ kind }: { kind: ChartKind }) {
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ width: "100%" }}>
      <div className="a-actions">
        <Button onClick={() => setEmpty(!empty)}>Bật/tắt dữ liệu</Button>
        <Button onClick={() => setLoading(!loading)}>Bật/tắt loading</Button>
      </div>
      {loading ? (
        <Skeleton rows={5} />
      ) : (
        <Chart kind={kind} data={empty ? [] : points} label="Lượt xem demo theo ngày" />
      )}
    </div>
  );
}
export default function Charts() {
  return (
    <>
      {componentCatalogue.charts.map((name, i) => (
        <Example
          key={name}
          name={name}
          description="Màu đồng nhất, có tóm tắt dữ liệu đọc được và không chạy animation biểu đồ."
          code={'<Chart kind="' + kinds[i] + '" data={points} label="Lượt xem theo ngày" />'}
        >
          <ChartExample kind={kinds[i]} />
        </Example>
      ))}
    </>
  );
}
