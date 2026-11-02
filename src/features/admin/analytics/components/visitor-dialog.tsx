import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin, useRecord } from "../../services/context";
import { Modal, Button, Skeleton, ErrorState } from "../../shared/ui/primitives";
import { dateTime } from "../../shared/lib/text";
import { listVisitorSessions } from "../visitor-service";
export function VisitorDialog({ visitorId, onClose }: { visitorId: string; onClose: () => void }) {
  const runtime = useAdmin(),
    visitor = useRecord("visitors", visitorId);
  const [page, setPage] = useState(1);
  const sessions = useQuery({
    queryKey: ["bibi-admin", "visitor-sessions", visitorId, page, runtime.session?.userId],
    queryFn: () =>
      listVisitorSessions(runtime.store, runtime.session, visitorId, {
        page,
        pageSize: 20,
        sort: { field: "startedAt", direction: "desc" },
      }),
    enabled: !!runtime.session,
  });
  const v = visitor.data;
  return (
    <Modal
      open
      title="Chi tiết khách truy cập"
      description="Dữ liệu mô phỏng, không xác định danh tính người thật."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      wide
    >
      <div className="a-dialog-body">
        {visitor.isPending ? (
          <Skeleton />
        ) : visitor.error ? (
          <ErrorState error={visitor.error} onRetry={() => void visitor.refetch()} />
        ) : (
          v && (
            <>
              <h2>{v.anonymousId}</h2>
              <dl className="a-key-values">
                {[
                  ["ID", v.anonymousId],
                  ["IP", v.ipAddress],
                  ["Vị trí", [v.city, v.country].filter(Boolean).join(", ")],
                  ["Thiết bị–Hệ điều hành", `${v.deviceType}–${v.operatingSystem}`],
                  ["Trình duyệt", v.browser],
                  ["Số phiên", v.sessionCount],
                  ["Lần đầu", dateTime(v.firstSeenAt)],
                  ["Lần cuối", dateTime(v.lastSeenAt)],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <h2>Phiên truy cập</h2>
              {sessions.isPending ? (
                <Skeleton />
              ) : sessions.error ? (
                <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
              ) : (
                sessions.data && (
                  <>
                    <p>
                      {sessions.data.total} phiên · Trang {sessions.data.page}/
                      {Math.max(1, Math.ceil(sessions.data.total / 20))}
                    </p>
                    {sessions.data.items.map((s) => (
                      <article key={s.id} className="a-visitor-session">
                        <strong>{dateTime(s.startedAt)}</strong>
                        <p>
                          {s.landingPage} → {s.exitPage}
                        </p>
                        <small>
                          {s.referrer || "Trực tiếp"} · {s.pages.length} trang ·{" "}
                          {s.endedAt
                            ? `${Math.max(0, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000))} phút`
                            : "Chưa kết thúc (demo)"}
                        </small>
                      </article>
                    ))}
                    {!sessions.data.items.length && <p>Chưa có phiên truy cập.</p>}
                    <div className="a-actions">
                      <Button
                        disabled={sessions.data.page <= 1}
                        onClick={() => setPage(sessions.data.page - 1)}
                      >
                        Phiên trước
                      </Button>
                      <Button
                        disabled={sessions.data.page * 20 >= sessions.data.total}
                        onClick={() => setPage(sessions.data.page + 1)}
                      >
                        Phiên sau
                      </Button>
                    </div>
                    <h2>Sản phẩm đã xem</h2>
                    <p>Gom từ các phiên demo, không phải ý định mua hàng.</p>
                    {sessions.data.viewedProducts.length ? (
                      <ul>
                        {sessions.data.viewedProducts.map((p) => (
                          <li key={p.slug}>{p.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Chưa có lượt xem chi tiết sản phẩm trong dữ liệu phiên.</p>
                    )}
                  </>
                )
              )}
            </>
          )
        )}
      </div>
    </Modal>
  );
}
