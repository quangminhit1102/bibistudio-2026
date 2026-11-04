import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../auth/password";
import { withTransaction } from "./transaction";
export const PROBE_USERNAME = "bibi_release_probe";

export async function assertProbeIdentity(pool: Pool): Promise<string> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT u.id,u.active,u.is_master,u.deleted_at,(SELECT COUNT(*) FROM user_roles ur WHERE ur.user_id=u.id) roles FROM users u WHERE username=?",
    [PROBE_USERNAME],
  );
  const user = rows[0];
  if (!user || !user.active || user.is_master || user.deleted_at || Number(user.roles) !== 0)
    throw new Error("Release probe identity must be active and have no roles");
  return String(user.id);
}
/** Explicit bootstrap; never reset an existing password/status or strip unexpected grants. */
export async function seedProbeIdentity(pool: Pool, password: string): Promise<void> {
  await withTransaction(pool, async (connection) => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE username=? FOR UPDATE",
      [PROBE_USERNAME],
    );
    if (rows.length) return;
    const id = randomUUID();
    await connection.execute(
      "INSERT INTO users(id,username,display_name,password_hash) VALUES (?,?,?,?)",
      [id, PROBE_USERNAME, "Kiểm tra phát hành", await hashPassword(password)],
    );
    await connection.execute(
      "INSERT INTO audit_logs(action,target_type,target_id) VALUES ('identity.probe_bootstrap','account',?)",
      [id],
    );
  });
  await assertProbeIdentity(pool);
}
