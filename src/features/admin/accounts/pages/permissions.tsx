import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin, useEntity, useRole } from "../../services/context";
import { actions, resources, can, resourceLabels } from "../permissions";
import type { Role, Resource, Action } from "../../services/contracts";
import {
  PageTitle,
  Card,
  Button,
  ErrorState,
  Skeleton,
  useNotice,
} from "../../shared/ui/primitives";
export default function Permissions() {
  const runtime = useAdmin();
  const self = useRole();
  const roles = useEntity("roles", { page: 1, pageSize: 100 });
  const query = useQueryClient();
  const notice = useNotice();
  const [draft, setDraft] = useState<Record<string, Role["permissions"]>>({});
  const [busy, setBusy] = useState(false);
  if (roles.isPending) return <Skeleton />;
  if (roles.error) return <ErrorState error={roles.error} />;
  const editable = can(runtime.session, "accounts", "update", self.data);
  return (
    <>
      <PageTitle
        title="Ma trận phân quyền"
        description="Chỉ mô phỏng quyền UI và mock service; backend thật phải tự xác thực và phân quyền."
        actions={
          <Button
            variant="primary"
            disabled={!editable || !Object.keys(draft).length}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                for (const role of roles.data?.items ?? [])
                  if (draft[role.id])
                    await runtime
                      .service("roles")
                      .update(role.id, { permissions: draft[role.id] }, role.revision);
                await query.invalidateQueries({ queryKey: ["bibi-admin"] });
                setDraft({});
                notice("Đã lưu ma trận quyền demo.");
              } catch (e) {
                notice(e instanceof Error ? e.message : "Không thể lưu", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Lưu phân quyền
          </Button>
        }
      />
      <Card>
        <div className="a-table-wrap" tabIndex={0} aria-label="Ma trận quyền có thể cuộn">
          <table className="a-table a-permission-table">
            <thead>
              <tr>
                <th>Tài nguyên / Hành động</th>
                {roles.data?.items.map((r) => (
                  <th key={r.id}>{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.flatMap((resource) =>
                actions.map((action) => (
                  <tr key={resource + action}>
                    <td>
                      <strong>{resourceLabels[resource] ?? resource}</strong> / {action}
                    </td>
                    {roles.data?.items.map((role) => (
                      <td key={role.id}>
                        <input
                          type="checkbox"
                          aria-label={`${role.name} ${resource} ${action}`}
                          checked={
                            (draft[role.id] ?? role.permissions)[resource]?.includes(action) ??
                            false
                          }
                          disabled={!editable || role.id === "super-admin"}
                          onChange={(e) => {
                            const permissions = { ...(draft[role.id] ?? role.permissions) };
                            permissions[resource] = e.target.checked
                              ? [...(permissions[resource] ?? []), action]
                              : (permissions[resource] ?? []).filter((a) => a !== action);
                            setDraft((v) => ({ ...v, [role.id]: permissions }));
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
