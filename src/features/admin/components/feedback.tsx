import { componentUsage } from "./usage";
import { componentLabel } from "./labels";
import { useState } from "react";
import { LoaderCircle, CheckCircle, TriangleAlert, AlertCircle } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  useNotice,
  ConfirmDialog,
} from "../shared/ui/primitives";
import { Example } from "./example";
import { componentCatalogue } from "./catalogue";
export function FeedbackExample({ name }: { name: string }) {
  const [value, setValue] = useState(35);
  const [retry, setRetry] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const notify = useNotice();
  if (name.includes("Notification") || name === "Toast")
    return (
      <Button
        onClick={() =>
          notify(
            name === "Warning Notification"
              ? "Còn bản nháp chưa lưu."
              : name === "Error Notification"
                ? "Ví dụ lỗi: chưa lưu dữ liệu."
                : "Thao tác đã hoàn tất.",
            name === "Error Notification"
              ? "error"
              : name === "Warning Notification"
                ? "info"
                : "success",
          )
        }
      >
        Hiện {componentLabel(name)}
      </Button>
    );
  if (name === "Progress Bar")
    return (
      <>
        <progress aria-label="Tiến độ xử lý" value={value} max={100} />
        <span>{value}%</span>
        <Button onClick={() => setValue((v) => (v >= 100 ? 0 : Math.min(v + 15, 100)))}>
          Tiếp tục xử lý
        </Button>
      </>
    );
  if (name === "Spinner")
    return (
      <span role="status">
        <LoaderCircle className="a-spin" />
        Đang xử lý ví dụ
      </span>
    );
  if (name === "Skeleton Loading")
    return (
      <>
        <Button onClick={() => setRetry(!retry)}>
          {retry ? "Hiện đang tải" : "Hiện nội dung"}
        </Button>
        {retry ? <p>Nội dung đã tải.</p> : <Skeleton rows={3} />}
      </>
    );
  if (name === "Empty State")
    return (
      <EmptyState
        title={retry ? "Đã tạo mục" : "Chưa có mục"}
        action={
          <Button onClick={() => setRetry(!retry)}>
            {retry ? "Xóa ví dụ" : "Tạo mục đầu tiên"}
          </Button>
        }
      />
    );
  if (name === "Error State" || name === "Retry State")
    return retry ? (
      <p role="status">
        Đã tải lại dữ liệu ví dụ thành công.{" "}
        <Button onClick={() => setRetry(false)}>lỗi lại</Button>
      </p>
    ) : (
      <ErrorState
        error={new Error("Ví dụ mất kết nối. Dữ liệu chưa được lưu.")}
        onRetry={() => setRetry(true)}
      />
    );
  if (name === "Confirmation Feedback")
    return (
      <>
        <Button onClick={() => setOpen(true)}>Xác nhận hoàn tất</Button>
        <ConfirmDialog
          open={open}
          title="Hoàn tất ví dụ?"
          description="Chỉ cập nhật trạng thái trên trang thư viện."
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            setConfirmed(true);
          }}
        />
        {confirmed && (
          <p role="status">
            <CheckCircle size={16} />
            Đã xác nhận.
          </p>
        )}
      </>
    );
  return (
    <div role="alert" className="a-info-banner">
      <TriangleAlert size={18} />
      Kiểm tra thông tin trước khi thực hiện thay đổi.
    </div>
  );
}
export default function Feedback() {
  return (
    <>
      {componentCatalogue.feedback.map((name) => (
        <Example
          key={name}
          name={name}
          description="Thông báo có nội dung cụ thể; thành công chỉ hiển thị sau thao tác."
          code={componentUsage("feedback", name)}
        >
          <FeedbackExample name={name} />
        </Example>
      ))}
    </>
  );
}
