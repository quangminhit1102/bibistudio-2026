import type { AdminHttpClient } from "../../../lib/admin-http";
import type { Resource } from "./contracts";
import type { EntityKey, EntityService, ListInput, ListResult, CreateInput, AdminModels } from "./contracts";

function basePath(entity: EntityKey, resource?: Resource): string {
  if (entity === "categories")
    return resource === "content" ? "/api/content-categories" : "/api/product-categories";
  const map: Record<string, string> = {
    posts: "/api/posts",
    products: "/api/products",
    customers: "/api/customers",
  };
  if (!map[entity]) throw new Error("Unsupported server entity: " + entity);
  return map[entity];
}

export function createHttpEntityService<K extends EntityKey>(
  client: AdminHttpClient,
  entity: K,
  resource?: Resource,
): EntityService<K> {
  const base = basePath(entity, resource);
  return {
    async list(input: ListInput) {
      const q = new URLSearchParams({
        page: String(input.page),
        size: String(input.pageSize),
      });
      if (input.search) q.set("q", input.search);
      if (input.sort) { q.set("sort", input.sort.field); q.set("dir", input.sort.direction); }
      for (const [k, v] of Object.entries(input.filters ?? {})) if (v) q.set("f_" + k, v);
      return client.request<ListResult<AdminModels[K]>>(`${base}?${q}`, { signal: input.signal });
    },
    async get(id, signal) {
      return client.request<AdminModels[K]>(`${base}/${id}`, { signal });
    },
    async create(input) {
      return client.request<AdminModels[K]>(base, { method: "POST", body: input });
    },
    async update(id, input, revision) {
      return client.request<AdminModels[K]>(`${base}/${id}`, { method: "PUT", body: input, ifMatch: revision });
    },
    async remove(id, revision) {
      await client.request<void>(`${base}/${id}`, { method: "DELETE", ifMatch: revision });
    },
    async bulk(action, records) {
      let updated = 0;
      const failures: { id: string; message: string }[] = [];
      for (const r of records) {
        try {
          if (action.type === "delete") await this.remove(r.id, r.revision);
          else await this.update(r.id, action.values as Partial<CreateInput<K>>, r.revision);
          updated++;
        } catch (e) {
          failures.push({ id: r.id, message: e instanceof Error ? e.message : "lá»—i" });
        }
      }
      return { updated, failures };
    },
    async export(input) {
      const rows: AdminModels[K][] = [];
      let page = 1;
      while (true) {
        const result = await this.list({ ...input, page, pageSize: 200 });
        rows.push(...result.items);
        if (rows.length >= result.total) break;
        page++;
      }
      return rows;
    },
  };
}
