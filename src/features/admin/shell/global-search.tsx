import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAdmin, useRole } from "../services/context";
import { searchAdmin } from "./search-service";
import { Modal, Skeleton, ErrorState, EmptyState } from "../shared/ui/primitives";

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
    queryKey: [
      "bibi-admin",
      "search",
      term,
      runtime.session?.userId,
      runtime.session?.kind === "http"
        ? runtime.session.principal.revision
        : runtime.session?.roleId,
    ],
    enabled: (runtime.session?.kind === "http" || !role.isPending) && term.trim().length > 1,
    queryFn: ({ signal }) =>
      searchAdmin(runtime.store, runtime.session, term, signal, runtime.http),
  });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Tìm trong workspace"
      description="Tìm sản phẩm, khách mua hàng, phiếu mua hàng, bài viết và người dùng."
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
                <small>{r.kind}</small>
              </button>
            ))
          ) : (
            <EmptyState
              title="Tìm dữ liệu"
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
