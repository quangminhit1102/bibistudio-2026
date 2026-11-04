import type { PoolConnection } from "mysql2/promise";
export interface AuditInput {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}
export async function writeAudit(connection: PoolConnection, event: AuditInput): Promise<void> {
  const metadata: Record<string, unknown> = {};
  for (const key of ["reason", "changedFields", "roleIds", "permissionIds", "sessionCount"]) {
    const value = event.metadata?.[key];
    if (typeof value === "string" && value.length <= 100) metadata[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) metadata[key] = value;
    else if (
      Array.isArray(value) &&
      value.length <= 200 &&
      value.every((item) => typeof item === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(item))
    )
      metadata[key] = value;
  }
  await connection.execute(
    "INSERT INTO audit_logs(actor_id,action,target_type,target_id,metadata) VALUES (?,?,?,?,?)",
    [
      event.actorId ?? null,
      event.action,
      event.targetType ?? null,
      event.targetId ?? null,
      JSON.stringify(metadata),
    ],
  );
}
