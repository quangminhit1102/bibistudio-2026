import { useState } from "react";
import type { VisitorSessionDto } from "../../../../../backend/src/http/contracts";
import { Button, ErrorState } from "../../shared/ui/primitives";
import { dateTime } from "../../shared/lib/text";

function safePath(path: string) {
  try {
    const decoded = decodeURIComponent(path);
    if (
      !path.startsWith("/") ||
      /[\\?#\s]/.test(decoded) ||
      decoded.startsWith("//") ||
      /^\/(admin|api)(\/|$)/i.test(decoded)
    )
      return null;
    const url = new URL(path, "https://bibistudio.vn");
    return url.origin === "https://bibistudio.vn" && url.pathname === path ? path : null;
  } catch {
    return null;
  }
}
export function VisitorSessionList({
  items,
  hasMore,
  onMore,
  loading = false,
  error,
}: {
  items: VisitorSessionDto[];
  hasMore: boolean;
  onMore: () => void;
  loading?: boolean;
  error?: unknown;
}) {
  const [open, setOpen] = useState(() => new Set(items[0] ? [items[0].id] : []));
  return (
    <div className="a-visitor-session-list">
      {!items.length && <p>Chưa ghi nhận phiên trong khoảng ngày đã chọn.</p>}
      {items.map((session) => (
        <details
          key={session.id}
          className="a-visitor-session-panel"
          open={open.has(session.id)}
          onToggle={(event) => {
            const expanded = event.currentTarget.open;
            setOpen((previous) => {
              if (previous.has(session.id) === expanded) return previous;
              const next = new Set(previous);
              if (expanded) next.add(session.id);
              else next.delete(session.id);
              return next;
            });
          }}
        >
          <summary>
            <span>
              <strong>{dateTime(session.startedAt)}</strong>
              <small>
                {session.products.length
                  ? session.products.map((p) => p.name).join(" · ")
                  : "Chưa ghi nhận sản phẩm"}
              </small>
            </span>
            <span className="a-visitor-session-count">{session.distinctPageCount} trang</span>
          </summary>
          <div className="a-visitor-session-body">
            <p className="a-muted">
              Ghi nhận gần nhất: {dateTime(session.lastReceivedAt)} ·{" "}
              {session.deviceType === "mobile"
                ? "Di động"
                : session.deviceType === "tablet"
                  ? "Máy tính bảng"
                  : "Máy tính"}{" "}
              · {session.operatingSystem || "Chưa xác định"} · {session.browser || "Chưa xác định"}
            </p>
            <p className="a-visitor-ip">
              IP: {session.ipStatus === "verified" ? session.ipAddress : "Chưa xác định"}
            </p>
            <h3>Sản phẩm quan tâm</h3>
            <div className="a-visitor-product-links">
              {session.products.map((product) => (
                <a
                  key={product.slug}
                  href={`/products/${encodeURIComponent(product.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {product.name}
                </a>
              ))}
            </div>
            <h3>Các trang đã ghi nhận</h3>
            <ul className="a-visitor-recorded-pages">
              {session.pages
                .filter((page) => safePath(page.path))
                .map((page) => (
                  <li key={page.path}>
                    <a href={safePath(page.path)!} target="_blank" rel="noopener noreferrer">
                      {page.path}
                    </a>
                    <time dateTime={page.firstReceivedAt}>{dateTime(page.firstReceivedAt)}</time>
                  </li>
                ))}
            </ul>
            {session.truncated && (
              <p role="note">Đã đạt giới hạn ghi nhận của phiên; danh sách có thể chưa đầy đủ.</p>
            )}
          </div>
        </details>
      ))}
      {!!error && <ErrorState error={error} onRetry={onMore} />}
      {hasMore && !error && (
        <Button
          aria-disabled={loading}
          onClick={() => {
            if (!loading) onMore();
          }}
        >
          Xem thêm phiên
        </Button>
      )}
      <p className="a-muted">
        Mỗi URL/sản phẩm được ghi một lần trong phiên, không phải lịch sử từng lần bấm. Cookie trình
        duyệt có hiệu lực 90 ngày; lịch sử đã lưu được giữ lại.
      </p>
    </div>
  );
}
