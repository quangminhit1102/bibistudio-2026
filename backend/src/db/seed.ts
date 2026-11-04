import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../auth/password";

export interface SeedSecrets {
  masterPassword: string;
  userPassword: string;
}
const resources = [
  "customer_access",
  "account",
  "role",
  "permission",
  "audit",
  "dashboard",
  "product",
  "category",
  "inventory",
  "customer",
  "sales_slip",
  "sales_report",
  "post",
  "media",
  "notification",
  "settings",
  "components",
];
const actions = [
  "view",
  "create",
  "update",
  "delete",
  "activate",
  "deactivate",
  "assign_role",
  "assign_permission",
  "revoke_session",
  "export",
  "settings",
];

/** Explicit bootstrap only. Never reset a seed identity, its status or mappings. */
export async function seedIdentity(pool: Pool, secrets: SeedSecrets): Promise<void> {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT(DATABASE(),':bibi-seed'),10) acquired",
    );
    if (lock.acquired !== 1) throw new Error("Seed lock unavailable");
    locked = true;
    await connection.beginTransaction();
    for (const resource of resources)
      for (const action of actions) {
        const code = `${resource}.${action}`;
        await connection.execute(
          "INSERT IGNORE INTO permissions(id,code,description) VALUES (?,?,?)",
          [code, code, code],
        );
      }
    await connection.execute(
      "INSERT IGNORE INTO roles(id,name,is_system,full_access) VALUES ('system-admin','Admin',1,1)",
    );
    const [userRoles] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM roles WHERE id='system-user'",
    );
    if (userRoles.length === 0) {
      await connection.execute(
        "INSERT INTO roles(id,name,is_system,full_access) VALUES ('system-user','User',1,0)",
      );
      await connection.execute(
        "INSERT INTO role_permissions(role_id,permission_id) VALUES ('system-user','customer_access.view')",
      );
    }
    for (const item of [
      {
        username: "admin",
        displayName: "Quản trị viên",
        master: true,
        role: "system-admin",
        password: secrets.masterPassword,
      },
      {
        username: "user01",
        displayName: "Người dùng",
        master: false,
        role: "system-user",
        password: secrets.userPassword,
      },
    ]) {
      const [found] = await connection.execute<RowDataPacket[]>(
        "SELECT id,is_master FROM users WHERE username=?",
        [item.username],
      );
      if (found.length) {
        if (item.master && !found[0].is_master)
          throw new Error("Master username collision; explicit recovery required");
        continue;
      }
      const id = randomUUID();
      const hash = await hashPassword(item.password);
      await connection.execute(
        "INSERT INTO users(id,username,display_name,password_hash,is_master) VALUES (?,?,?,?,?)",
        [id, item.username, item.displayName, hash, item.master ? 1 : null],
      );
      await connection.execute("INSERT INTO user_roles(user_id,role_id) VALUES (?,?)", [
        id,
        item.role,
      ]);
      await connection.execute(
        "INSERT INTO audit_logs(action,target_type,target_id) VALUES ('identity.bootstrap','account',?)",
        [id],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':bibi-seed'))");
    connection.release();
  }
}
