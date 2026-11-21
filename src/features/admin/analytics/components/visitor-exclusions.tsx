import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import type { createVisitorApi } from "../http-api";
import { Button, ErrorState, Modal, Skeleton } from "../../shared/ui/primitives";
import { RefreshButton } from "../../shared/ui/refresh-button";

type Api = ReturnType<typeof createVisitorApi>;
export function VisitorExclusions({ api, onClose }: { api: Api; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["bibi-admin", "visitor-exclusions"],
    queryFn: ({ signal }) => api.exclusions(signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Loại trừ IP"
      description="Không ghi nhận lượt truy cập mới từ IP khớp quy tắc đã lưu."
      className="a-visitor-modal"
      wide
    >
      <div className="a-dialog-body">
        {query.isPending ? (
          <Skeleton />
        ) : !query.data ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <ExclusionForm
            key={query.data.revision}
            initial={query.data}
            api={api}
            onClose={onClose}
            onReload={() => {
              void query.refetch();
            }}
          />
        )}
      </div>
    </Modal>
  );
}
function ExclusionForm({
  initial,
  api,
  onClose,
  onReload,
}: {
  initial: { revision: number; rules: string[] };
  api: Api;
  onClose: () => void;
  onReload: () => void;
}) {
  const [rules, setRules] = useState(initial.rules);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setConflict(false);
        try {
          await api.saveExclusions({
            revision: initial.revision,
            rules: [
              ...rules,
              ...draft
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean),
            ],
          });
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Không lưu được cấu hình.");
          setConflict(
            !!err && typeof err === "object" && "code" in err && err.code === "REVISION_CONFLICT",
          );
        } finally {
          setSaving(false);
        }
      }}
      className="a-exclusion-form"
    >
      <div className="a-exclusion-rules">
        {rules.map((rule, index) => (
          <div className="a-exclusion-rule" key={rule}>
            <code>{rule}</code>
            <Button
              disabled={saving}
              size="icon"
              variant="ghost"
              aria-label={`Bỏ quy tắc ${rule}`}
              onClick={() => setRules(rules.filter((_, i) => i !== index))}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        {!rules.length && <p className="a-muted">Chưa có IP loại trừ.</p>}
      </div>
      <label className="a-field">
        <span>Thêm quy tắc</span>
        <textarea
          aria-label="Thêm quy tắc"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder={"192.0.2.10\n192.0.2.*\n192.0.*.*"}
        />
        <small>Mỗi dòng một IP đầy đủ hoặc mẫu IPv4 có dấu *. Tối đa 200 quy tắc.</small>
      </label>
      <p className="a-muted">Áp dụng cho lượt truy cập mới. Lịch sử đã ghi nhận được giữ nguyên.</p>
      {error && (
        <p className="a-error" role="alert">
          {error}
        </p>
      )}
      {conflict && (
        <div>
          <p className="a-muted">
            Cấu hình đã được thay đổi. Sao chép nội dung bạn cần giữ trước khi tải lại.
          </p>
          <RefreshButton disabled={saving} onClick={onReload} />
        </div>
      )}
      <div className="a-actions a-exclusion-footer">
        <Button disabled={saving} onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Lưu cấu hình
        </Button>
      </div>
    </form>
  );
}
