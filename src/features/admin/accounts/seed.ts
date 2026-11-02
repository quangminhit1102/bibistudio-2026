import { seedBase } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
import { defaultPermissions, roleNames } from "./permissions";
export function seed(): SeedBatch {
  return {
    roles: Object.entries(roleNames).map(([id, name]) => ({
      ...seedBase(id),
      name,
      permissions: defaultPermissions(id),
    })),
    users: Array.from({ length: 30 }, (_, i) => ({
      ...seedBase(`user-${i + 1}`, i),
      name:
        ["Minh Nguyễn", "An Trần", "Huy Lê", "Mai Phạm", "Linh Võ"][i % 5] +
        (i > 4 ? ` ${i + 1}` : ""),
      email: `account${i + 1}@example.test`,
      roleId: i === 0 ? "super-admin" : Object.keys(roleNames)[1 + (i % 4)],
      active: true,
      lastLogin: "2026-10-31T08:00:00Z",
    })),
  };
}
