import { EntityManager } from "../../shared/entity-manager";
import { customerConfig } from "../config";
import { lazy, Suspense, useState } from "react";
import { useAdmin, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { Button } from "../../shared/ui/primitives";
const ImportDialog = lazy(() => import("../import/import-dialog"));
export default function CustomerList() {
  const [open, setOpen] = useState(false);
  const runtime = useAdmin();
  const role = useRole();
  const allowed = can(runtime.session, "bookstore", "create", role.data);
  return (
    <>
      <EntityManager
        config={{
          ...customerConfig,
          headerActions: allowed ? (
            <Button onClick={() => setOpen(true)}>Import Excel</Button>
          ) : undefined,
        }}
      />
      {open && allowed && (
        <Suspense fallback={<p role="status">Đang mở import…</p>}>
          <ImportDialog onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
