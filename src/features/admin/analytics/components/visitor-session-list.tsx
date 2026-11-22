import { useState } from "react";
import { Trash2 } from "lucide-react";
import { site } from "@/platform/site";
import type { VisitorSessionDto } from "../../../../../backend/src/http/contracts";
import { Button, ErrorState } from "../../shared/ui/primitives";
import { dateTime } from "../../shared/lib/text";
import { VisitorIp, VisitorLocation } from "./visitor-context";

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
    const url = new URL(path, site.url);
    return url.origin === site.url && url.pathname === path ? path : null;
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
  onDelete,
}: {
  items: VisitorSessionDto[];
  hasMore: boolean;
  onMore: () => void;
  loading?: boolean;
  error?: unknown;
  onDelete?: (session: VisitorSessionDto) => void;
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
                  : "Không ghi nhận"}
              </small>
            </span>
            <span className="a-visitor-session-count">{session.distinctPageCount} trang</span>
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="a-visitor-delete"
                aria-label={`Xóa phiên ${dateTime(session.startedAt)}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete(session);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
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
              IP: <VisitorIp value={session} />
            </p>
            <p>
              Quốc gia: <VisitorLocation value={session} />
            </p>
            <h3>Sản phẩm quan tâm</h3>
            <div className="a-visitor-product-links">
              {!session.products.length && <span className="a-muted">Không ghi nhận</span>}
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
    </div>
  );
}
