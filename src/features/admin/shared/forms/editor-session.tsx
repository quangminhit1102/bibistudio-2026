import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin, useRecord, useRole } from "../../services/context";
import { can } from "../../accounts/permissions";
import { postConfig } from "../../content/config";
import { productConfig } from "../../products/config";
import type { AdminModels, CreateInput } from "../../services/contracts";
import type { FormValues } from "./record-form";
import { useUnsavedChanges } from "./unsaved-guard";
export function useEditorSession(entity: "posts" | "products", id?: string) {
  const runtime = useAdmin(),
    query = useQueryClient(),
    role = useRole();
  const config = entity === "posts" ? postConfig : productConfig;
  const record = useRecord(entity, id ?? "");
  const [snapshot, setSnapshot] = useState<AdminModels[typeof entity] | null>(record.data ?? null);
  const [dirty, dirtyChanged] = useState(false);
  useEffect(() => {
    if (record.data && (!snapshot || snapshot.id !== record.data.id)) setSnapshot(record.data);
  }, [record.data, snapshot]);
  const blocker = useUnsavedChanges(dirty);
  const resource = entity === "posts" ? "content" : "products";
  const canEdit = can(runtime.session, resource, id ? "update" : "create", role.data);
  return {
    initial: (id ? snapshot : config.defaults) as unknown as FormValues,
    loading: Boolean(id && (record.isPending || !snapshot || snapshot.id !== id)),
    error: record.error,
    retry: () => void record.refetch(),
    canEdit,
    dirtyChanged,
    blocker,
    save: async (values: FormValues) => {
      if (!canEdit) throw new Error("Bạn không có quyền chỉnh sửa dữ liệu này.");
      const editable = Object.fromEntries(
        config.fields
          .filter((f) => Object.hasOwn(values, f.key))
          .map((f) => [f.key, values[f.key]]),
      );
      const service = runtime.service(entity);
      if (id && snapshot)
        await service.update(
          id,
          editable as Partial<CreateInput<typeof entity>>,
          snapshot.revision,
        );
      else await service.create({ ...config.defaults, ...editable } as CreateInput<typeof entity>);
      await query.invalidateQueries({ queryKey: ["bibi-admin"] });
      flushSync(() => dirtyChanged(false));
    },
  };
}
