import { useRecordId } from "../../shared/record-editor";
import { useRecord, useEntity } from "../../services/context";
import { PageTitle, Card, ErrorState, Skeleton } from "../../shared/ui/primitives";
import { date } from "../../shared/lib/text";
export default function VisitorDetail() {
  const id = useRecordId();
  const visitor = useRecord("visitors", id);
  const sessions = useEntity("sessions", {
    page: 1,
    pageSize: 200,
    filters: { visitorId: id },
    sort: { field: "startedAt", direction: "desc" },
  });
  if (visitor.isPending || sessions.isPending) return <Skeleton />;
  if (visitor.error || sessions.error)
    return <ErrorState error={visitor.error ?? sessions.error} />;
  const v = visitor.data!;
  return (
    <>
      <PageTitle title={v.anonymousId} description="Hồ sơ, không phải một cá nhân thật." />
      <div className="a-detail-grid">
        <Card>
          <h2>Lịch sử phiên</h2>
          {sessions.data?.items.map((s) => (
            <div
              key={s.id}
              style={{ padding: "20px 0", borderBottom: "1px solid var(--a-border)" }}
            >
              <strong>
                {date(s.startedAt)} · {s.referrer}
              </strong>
              <small style={{ display: "block" }}>
                {s.landingPage} → {s.exitPage} · {s.pages.length} lượt xem
              </small>
              <ol className="a-timeline" style={{ marginTop: 15 }}>
                {s.pages.map((p, i) => (
                  <li key={i}>
                    {p.path}
                    <small>
                      {new Date(p.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                    </small>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </Card>
        <Card>
          <h2>Thông tin</h2>
          <dl className="a-key-values" style={{ marginTop: 18 }}>
            {Object.entries(v)
              .filter(([k]) => !["id", "createdAt", "updatedAt", "revision"].includes(k))
              .map(([k, value]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
          </dl>
          <p style={{ marginTop: 20, fontSize: 11, color: "var(--a-muted)" }}>
            Vị trí là dữ liệu giả lập; không suy luận danh tính từ địa chỉ IP.
          </p>
        </Card>
      </div>
    </>
  );
}
