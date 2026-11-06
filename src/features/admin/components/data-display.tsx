import { componentUsage } from "./usage";
import { useState } from "react";
import { Button, Badge, Card, EmptyState, Skeleton, Tooltip } from "../shared/ui/primitives";
import { DataTable, type TableState } from "../shared/tables/data-table";
import { downloadBlob, makeCsv } from "../shared/lib/text";
import { Example } from "./example";
import { OverlayExample } from "./overlays";
import { componentCatalogue } from "./catalogue";
const initialRows = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  name: ["Sổ tay Đà Nẵng", "Sổ tay Đà Lạt", "Thiệp Việt Nam"][i % 3],
  stock: i + 3,
}));
export function TableExample() {
  const [rows, setRows] = useState(initialRows);
  const [state, setState] = useState<TableState>({
    page: 1,
    pageSize: 10,
    search: "",
    filters: {},
  });
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div className="a-actions">
        <Button onClick={() => setLoading(!loading)}>Bật/tắt đang tải</Button>
        <Button onClick={() => setError(!error)}>Bật/tắt lỗi</Button>
        <Button onClick={() => setRows(rows.length ? [] : initialRows)}>Bật/tắt rỗng</Button>
        <Button
          disabled={!Object.keys(selection).some((k) => selection[k])}
          onClick={() => {
            setRows(rows.map((r) => (selection[r.id] ? { ...r, stock: r.stock + 1 } : r)));
            setSelection({});
          }}
        >
          Tăng kho mục đã chọn
        </Button>
      </div>
      <DataTable
        columns={[
          { accessorKey: "name", header: "Sản phẩm" },
          { accessorKey: "stock", header: "Tồn kho" },
        ]}
        clientRows={rows}
        result={{ items: rows, total: rows.length, page: state.page, pageSize: state.pageSize }}
        state={state}
        onStateChange={setState}
        selection={selection}
        onSelectionChange={setSelection}
        loading={loading}
        error={error ? new Error("Ví dụ lỗi tải bảng.") : undefined}
        onRetry={() => setError(false)}
        onExport={() =>
          downloadBlob(
            new Blob([makeCsv([["name", "stock"], ...rows.map((r) => [r.name, r.stock])])], {
              type: "text/csv;charset=utf-8",
            }),
            "showcase.csv",
          )
        }
      />
    </div>
  );
}
export function DataExample({ name }: { name: string }) {
  const [value, setValue] = useState(45);
  const [loaded, setLoaded] = useState(false);
  if (name === "Data Table") return <TableExample />;
  if (name === "Table")
    return (
      <table>
        <caption>Bảng mẫu tồn kho</caption>
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Tồn</th>
          </tr>
        </thead>
        <tbody>
          {initialRows.slice(0, 3).map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  if (name === "Badge")
    return (
      <>
        {(["neutral", "success", "warning", "error", "info", "privilege"] as const).map((t) => (
          <Badge key={t} tone={t}>
            {
              {
                neutral: "Trung tính",
                success: "Thành công",
                warning: "Cảnh báo",
                error: "Lỗi",
                info: "Thông tin",
                privilege: "Quyền / Bảo vệ",
              }[t]
            }
          </Badge>
        ))}
      </>
    );
  if (name === "Avatar" || name === "Avatar Group")
    return (
      <div className="a-actions" aria-label="Nhóm biên tập">
        {(name === "Avatar" ? ["MN"] : ["MN", "AT", "HL"]).map((v) => (
          <span key={v} className="a-avatar" title={v}>
            {v}
          </span>
        ))}
      </div>
    );
  if (name === "Tooltip" || name === "Popover") return <OverlayExample name={name} />;
  if (name === "Separator")
    return (
      <div style={{ width: "100%" }}>
        Sản phẩm
        <hr />
        Nội dung
      </div>
    );
  if (name === "Progress")
    return (
      <>
        <progress aria-label="Tiến độ" value={value} max={100} />
        <Button onClick={() => setValue((v) => (v + 10) % 110)}>{value}% · tăng</Button>
      </>
    );
  if (name === "Skeleton")
    return (
      <>
        <Button onClick={() => setLoaded(!loaded)}>Đổi trạng thái</Button>
        {loaded ? <p>Đã tải nội dung.</p> : <Skeleton rows={3} />}
      </>
    );
  if (name === "Empty State")
    return (
      <EmptyState
        title={loaded ? "Đã thêm bản nháp" : "Không có bản nháp"}
        action={
          <Button onClick={() => setLoaded(!loaded)}>{loaded ? "Đặt lại" : "Tạo bản nháp"}</Button>
        }
      />
    );
  if (name === "Statistic Card")
    return (
      <div>
        <small>Sản phẩm</small>
        <h3>50</h3>
        <Badge tone="success">+5 trong tháng</Badge>
      </div>
    );
  if (name === "Key-Value List")
    return (
      <dl className="a-key-values">
        <dt>Mã sản phẩm</dt>
        <dd>BIBI-001</dd>
        <dt>Bộ sưu tập</dt>
        <dd>Khám phá Việt Nam</dd>
      </dl>
    );
  if (name === "Timeline")
    return (
      <ol className="a-timeline">
        {["Tạo bản nháp", "Duyệt nội dung", "Xuất bản"].map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ol>
    );
  if (name === "Status Indicator")
    return (
      <>
        {["Sẵn sàng", "Đang xử lý", "Tạm dừng"].map((v, i) => (
          <span key={v}>
            <span className="a-dot" style={{ background: ["#687b6b", "#c7ad85", "#8d9aaa"][i] }} />
            {v}{" "}
          </span>
        ))}
      </>
    );
  if (name === "Code Block")
    return (
      <pre>
        <code>{"const products: Product[] = await api.products.list();"}</code>
      </pre>
    );
  if (name === "Image Preview")
    return (
      <button aria-label="Phóng to ảnh sổ tay" onClick={() => setLoaded(!loaded)}>
        <img
          src={import.meta.env.BASE_URL + "catalogue/notebook-map-da-nang-mockup.webp"}
          alt="Sổ tay bản đồ Đà Nẵng"
          style={{ maxWidth: loaded ? 280 : 140, width: "100%" }}
          onError={(e) => {
            e.currentTarget.alt = "Chọn ảnh trong Thư viện ảnh để xem trước.";
          }}
        />
      </button>
    );
  return (
    <Card>
      <h3>Sản phẩm BiBi</h3>
      <p>Khối nội dung dùng chung giữa các module.</p>
      <Button onClick={() => setLoaded(!loaded)}>{loaded ? "Đã theo dõi" : "Theo dõi khối"}</Button>
    </Card>
  );
}
export default function DataDisplay() {
  return (
    <>
      {componentCatalogue["data-display"].map((name) => (
        <Example
          key={name}
          name={name}
          description="Cách hiển thị nội dung nhất quán; bảng cuộn bên trong khối trên màn hình nhỏ."
          code={componentUsage("data-display", name)}
        >
          <DataExample name={name} />
        </Example>
      ))}
    </>
  );
}
