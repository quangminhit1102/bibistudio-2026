import { Link, useSearch } from "@tanstack/react-router";
import { useAdmin, useEntity, useRecord, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { useRecordId } from "../../shared/record-editor";
import { PageTitle, Card, Badge, ErrorState, Skeleton } from "../../shared/ui/primitives";
import { internalTarget } from "../../shared/lib/navigation";
import { date, money } from "../../shared/lib/text";
import { customerKinds, customerReturnTo } from "../config";
function CustomerSlips({ id }: { id: string }) {
  const result = useEntity("purchaseSlips", {
    page: 1,
    pageSize: 5,
    filters: { customerId: id },
    sort: { field: "createdAt", direction: "desc" },
  });
  if (result.isPending) return <Skeleton />;
  if (result.error)
    return <ErrorState error={result.error} onRetry={() => void result.refetch()} />;
  return (
    <Card>
      <h2>Phiếu mua hàng ({result.data.total})</h2>
      <Link
        to={"/admin/sales/slips" as "/admin"}
        search={{ f_customerId: id } as never}
        className="a-btn"
      >
        Xem các phiếu của khách
      </Link>
      {result.data.items.map((slip) => (
        <p key={slip.id}>
          <Link to={`/admin/sales/slips/${slip.id}` as "/admin"}>{slip.number}</Link> ·{" "}
          {date(slip.createdAt)} · {money(slip.total)} ·{" "}
          {slip.status === "void" ? "Đã hủy" : "Đã lưu"}
        </p>
      ))}
    </Card>
  );
}
export default function CustomerDetail() {
  const id = useRecordId(),
    record = useRecord("customers", id),
    role = useRole(),
    runtime = useAdmin();
  const search = useSearch({ strict: false }) as { returnTo?: unknown };
  const back = customerReturnTo(search.returnTo);
  if (record.isPending) return <Skeleton />;
  if (record.error || !record.data) return <ErrorState error={record.error} />;
  const c = record.data;
  return (
    <>
      <PageTitle
        title={c.name}
        description="Thông tin khách mua hàng · Demo"
        actions={
          <>
            <Link {...internalTarget(back)} className="a-btn">
              Quay lại
            </Link>
            {can(runtime.session, "bookstore", "update", role.data) && (
              <Link
                to={`/admin/customers/${id}/edit` as "/admin"}
                search={{ returnTo: back } as never}
                className="a-btn a-btn-primary"
              >
                Chỉnh sửa
              </Link>
            )}
          </>
        }
      />
      <Card>
        <dl className="a-key-values">
          {[
            ["Mã khách", c.id],
            ["Loại khách", customerKinds.find((k) => k.value === c.kind)?.label],
            ["Địa chỉ", c.address || "—"],
            ["Điện thoại", c.phone || "—"],
            ["Email", c.email || "—"],
            ["Thông tin thêm", c.notes || "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div>
            <dt>VAT mặc định</dt>
            <dd>
              <Badge>{c.vatApplied ? "Có VAT" : "Không VAT"}</Badge>
            </dd>
          </div>
          <div>
            <dt>Sử dụng</dt>
            <dd>{c.active ? "Đang sử dụng" : "Ngừng sử dụng"}</dd>
          </div>
        </dl>
      </Card>
      {can(runtime.session, "sales", "view", role.data) && <CustomerSlips id={id} />}
    </>
  );
}
