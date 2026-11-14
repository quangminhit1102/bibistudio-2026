import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ensureTestDatabase } from "../../../scripts/test-database.mjs";
import { createAuthFixture } from "./auth.mjs";
import { migrateProfiles } from "../../dist/profile/schema.js";
import { migrateVisitorContext } from "../../dist/visitors/context-schema.js";
import { migrateContent } from "../../dist/content/schema.js";

export async function createContentFixture(t, { migrate = true } = {}) {
  await ensureTestDatabase();
  const f = await createAuthFixture(t);
  await migrateProfiles(f.pool, resolve("backend/profile-migrations"));
  await migrateVisitorContext(f.pool, resolve("backend/visitor-context-migrations"));
  const root = await mkdtemp(join(tmpdir(), "bibi-content-"));
  t.after(async () => {
    if (
      dirname(resolve(root)) !== resolve(tmpdir()) ||
      !root.split(/[\\/]/).at(-1).startsWith("bibi-content-")
    )
      throw Error("Unexpected content fixture path");
    await rm(root, { recursive: true, force: true });
  });
  const paths = {
    root,
    media: join(root, "media"),
    generations: join(root, "generations"),
    active: join(root, "active"),
    deployLock: join(root, "environment.lock"),
    maxManagedBytes: 4 * 1024 ** 3,
    maxContentBytes: 1024 ** 3,
    maxGenerationBytes: 64 * 1024 ** 2,
    minHeadroomBytes: 256 * 1024 ** 2,
  };
  for (const directory of [paths.media, paths.generations]) await mkdir(directory);
  const actors = {};
  for (const [name, permissions] of [
    ["editor", ["post.view", "post.create", "post.update"]],
    ["viewer", ["post.view"]],
  ]) {
    const id = randomUUID(),
      role = randomUUID();
    await f.pool.execute("INSERT INTO roles(id,name,is_system,full_access) VALUES(?,?,0,0)", [
      role,
      `Content ${name}`,
    ]);
    for (const permission of permissions)
      await f.pool.execute("INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)", [
        role,
        permission,
      ]);
    await f.pool.execute(
      "INSERT INTO users(id,username,display_name,password_hash) SELECT ?,?,?,password_hash FROM users WHERE username='user01'",
      [id, name, `Content ${name}`],
    );
    await f.pool.execute("INSERT INTO user_roles(user_id,role_id) VALUES(?,?)", [id, role]);
    const grant = await f.auth.login({ username: name, password: f.secrets.userPassword });
    actors[name] = await f.auth.authenticate(grant.accessToken);
  }
  const grant = await f.auth.login({ username: "admin", password: f.secrets.masterPassword });
  if (migrate) await migrateContent(f.pool, resolve("backend/content-migrations"));
  return { ...f, paths, admin: await f.auth.authenticate(grant.accessToken), ...actors };
}

export const validDraft = (patch = {}) => ({
  title: "Bài viết thử",
  slug: "bai-viet-thu",
  excerpt: "Giới thiệu",
  content: JSON.stringify({ format: "html-v1", html: "<p>Nội dung</p>" }),
  categoryId: null,
  tags: [],
  author: { kind: "brand" },
  coverMediaId: null,
  coverAlt: "",
  seoTitle: "",
  seoDescription: "",
  ...patch,
});
export const validCategory = (patch = {}) => ({
  name: "Cảm hứng",
  slug: "cam-hung",
  description: "",
  parentId: null,
  position: 0,
  active: true,
  seoTitle: "",
  seoDescription: "",
  ...patch,
});
