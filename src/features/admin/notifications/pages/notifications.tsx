import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAdmin, useEntity, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import {
  PageTitle,
  Button,
  Card,
  Badge,
  ErrorState,
  Skeleton,
  EmptyState,
  useNotice,
} from "../../shared/ui/primitives";
import { date } from "../../shared/lib/text";
export default function Notifications() {
  const runtime = useAdmin();
  const role = useRole();
  const notice = useNotice();
  const client = useQueryClient();
  const [filter, setFilter] = useState("");
  const result = useEntity("notifications", {
    page: 1,
    pageSize: 100,
    filters: filter ? { read: filter } : {},
  });
  const allowed = can(runtime.session, "notifications", "update", role.data);
  const mark = async (id: string, read: boolean, revision: number) => {
    await runtime.service("notifications").update(id, { read }, revision);
    await client.invalidateQueries({ queryKey: ["bibi-admin"] });
  };
  return (
    <>
      <PageTitle
        title="Thông báo"
        description="Thông tin và nhắc việc trong workspace."
        actions={
          <Button
            disabled={!allowed}
            onClick={async () => {
              try {
                const all = await runtime.service("notifications").list({ page: 1, pageSize: 200 });
                for (const n of all.items.filter((n) => !n.read))
                  await mark(n.id, true, n.revision);
                notice("Đã đánh dấu tất cả là đã đọc.");
              } catch (e) {
                notice(e instanceof Error ? e.message : "Không thể cập nhật", "error");
              }
            }}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <div className="a-toolbar">
        <select
          aria-label="Lọc thông báo"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tất cả</option>
          <option value="false">Chưa đọc</option>
          <option value="true">Đã đọc</option>
        </select>
      </div>
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} />
      ) : !result.data?.total ? (
        <EmptyState title="Không có thông báo" />
      ) : (
        result.data.items.map((n) => (
          <Card key={n.id} className="a-notification-card">
            <div className="a-card-head">
              <div>
                <h3>{n.name}</h3>
                <small>{date(n.createdAt)}</small>
              </div>
              <Badge tone={n.read ? "neutral" : "warning"}>{n.read ? "Đã đọc" : "Chưa đọc"}</Badge>
            </div>
            <p style={{ fontSize: 12, color: "var(--a-muted)", marginBottom: 16 }}>
              {n.description}
            </p>
            <div className="a-actions">
              <Link to={n.href as "/admin"} className="a-btn a-btn-sm">
                Xem liên quan
              </Link>
              <Button
                size="sm"
                disabled={!allowed}
                onClick={async () => {
                  try {
                    await mark(n.id, !n.read, n.revision);
                  } catch (e) {
                    notice(e instanceof Error ? e.message : "Cập nhật thất bại", "error");
                  }
                }}
              >
                {n.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
              </Button>
            </div>
          </Card>
        ))
      )}
    </>
  );
}
