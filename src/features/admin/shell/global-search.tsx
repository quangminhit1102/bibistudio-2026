import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAdmin, useRole } from "../services/context";
import { can, resourceForEntity } from "../accounts/permissions";
import { Modal, Button, Skeleton, ErrorState, EmptyState } from "../shared/ui/primitives";
import type { EntityKey } from "../services/contracts";
const paths = {
  products: "/admin/products/",
  books: "/admin/bookstore/books/",
  orders: "/admin/sales/orders/",
  posts: "/admin/content/posts/",
  users: "/admin/accounts/users",
};
export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const runtime = useAdmin();
  const role = useRole();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const results = useQuery({
    queryKey: ["bibi-admin", "search", term, runtime.session?.roleId],
    enabled: term.trim().length > 1,
    queryFn: async ({ signal }) => {
      const matches = [];
      for (const entity of Object.keys(paths) as (keyof typeof paths)[]) {
        if (!can(runtime.session, resourceForEntity(entity), "view", role.data)) continue;
        await runtime.ensure(entity);
        const r = await runtime
          .service(entity)
          .list({ page: 1, pageSize: 5, search: term, signal });
        for (const row of r.items)
          matches.push({
            id: row.id,
            label:
              "name" in row
                ? String(row.name)
                : "title" in row
                  ? String(row.title)
                  : "number" in row
                    ? String(row.number)
                    : "",
            entity,
            path: paths[entity] + (entity === "users" ? "" : row.id),
          });
      }
      return matches;
    },
  });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Tìm trong workspace"
      description="Tìm sản phẩm, sách, đơn hàng, bài viết và người dùng demo."
    >
      <div className="a-dialog-body">
        <input
          autoFocus
          aria-label="Từ khóa quản trị"
          placeholder="Nhập ít nhất 2 ký tự…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="a-search-results">
          {results.isFetching ? (
            <Skeleton />
          ) : results.error ? (
            <ErrorState error={results.error} />
          ) : results.data?.length ? (
            results.data.map((r) => (
              <button
                key={r.entity + r.id}
                onClick={() => {
                  onClose();
                  void navigate({ to: r.path as "/admin" });
                }}
              >
                <span>{r.label}</span>
                <small>{r.entity}</small>
              </button>
            ))
          ) : (
            <EmptyState
              title="Tìm dữ liệu demo"
              description={
                term.length > 1
                  ? "Không có kết quả phù hợp."
                  : "Kết quả được giới hạn theo quyền của tài khoản."
              }
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
