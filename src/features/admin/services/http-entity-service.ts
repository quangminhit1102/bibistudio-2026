import type { AdminHttpClient } from "../../../lib/admin-http";
import type { Resource } from "./contracts";
import type {
  EntityKey,
  EntityService,
  ListInput,
  ListResult,
  CreateInput,
  AdminModels,
} from "./contracts";

function basePath(entity: EntityKey, resource?: Resource): string {
  if (entity === "categories")
    return resource === "content" ? "/api/content-categories" : "/api/product-categories";
  const map: Record<string, string> = {
    productTypes: "/api/product-types",
    posts: "/api/posts",
    products: "/api/products",
    customers: "/api/customers",
  };
  if (!map[entity]) throw new Error("Unsupported server entity: " + entity);
  return map[entity];
}

type Row = Record<string, unknown>;
type Translations = Record<string, Record<string, string>>;

// A product type or collection keeps its per-language texts in `translations`; the forms
// edit them as one field each. Form field -> [locale, key in translations].
const typeTexts = {
  plural: ["vi", "plural"],
  nameEn: ["en", "name"],
  pluralEn: ["en", "plural"],
  taglineEn: ["en", "tagline"],
} as const;
const collectionTexts = {
  tagline: ["vi", "tagline"],
  nameEn: ["en", "name"],
  taglineEn: ["en", "tagline"],
  introEn: ["en", "intro"],
} as const;
type Texts = Record<string, readonly [string, string]>;

function textsFor(entity: EntityKey, resource?: Resource): Texts | undefined {
  if (entity === "productTypes") return typeTexts;
  if (entity === "categories" && resource !== "content") return collectionTexts;
  return undefined;
}

function flatten<T>(row: T, texts?: Texts): T {
  if (!texts) return row;
  const translations = ((row as Row).translations ?? {}) as Translations;
  const flat: Row = {};
  for (const [field, [locale, key]] of Object.entries(texts))
    flat[field] = translations[locale]?.[key] ?? "";
  return { ...row, ...flat };
}

/** The request body for a form's values; `stored` is the record's current `translations`. */
function unflatten(input: Row, entity: EntityKey, texts: Texts | undefined, stored?: Translations) {
  const { kind: _kind, translations: _sent, ...body } = input;
  if (!texts) return entity === "categories" ? body : input;
  const edited = Object.keys(texts).filter((field) => field in body);
  const translations: Translations = structuredClone(stored ?? {});
  const set = (locale: string, key: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) (translations[locale] ??= {})[key] = value;
    else delete translations[locale]?.[key];
  };
  for (const field of edited) {
    set(texts[field][0], texts[field][1], body[field]);
    delete body[field];
  }
  // The name and description columns are the Vietnamese texts; keep their copy in step.
  if ("name" in body) set("vi", "name", body.name);
  if ("description" in body)
    set("vi", entity === "productTypes" ? "tagline" : "intro", body.description);
  if (!edited.length && !("name" in body) && !("description" in body)) return body;
  for (const locale of Object.keys(translations))
    if (!Object.keys(translations[locale]).length) delete translations[locale];
  return { ...body, translations };
}

export function createHttpEntityService<K extends EntityKey>(
  client: AdminHttpClient,
  entity: K,
  resource?: Resource,
): EntityService<K> {
  const base = basePath(entity, resource);
  const texts = textsFor(entity, resource);
  return {
    async list(input: ListInput) {
      const q = new URLSearchParams({
        page: String(input.page),
        size: String(input.pageSize),
      });
      if (input.search) q.set("q", input.search);
      if (input.sort) {
        q.set("sort", input.sort.field);
        q.set("dir", input.sort.direction);
      }
      for (const [k, v] of Object.entries(input.filters ?? {})) if (v) q.set("f_" + k, v);
      const page = await client.request<ListResult<AdminModels[K]>>(`${base}?${q}`, {
        signal: input.signal,
      });
      return texts ? { ...page, items: page.items.map((row) => flatten(row, texts)) } : page;
    },
    async get(id, signal) {
      return flatten(await client.request<AdminModels[K]>(`${base}/${id}`, { signal }), texts);
    },
    async create(input) {
      const body = unflatten(input as Row, entity, texts);
      return flatten(await client.request<AdminModels[K]>(base, { method: "POST", body }), texts);
    },
    async update(id, input, revision) {
      // A type's code is set once; the API refuses a body that names it.
      const { code: _code, ...values } = input as Row;
      const changes = entity === "productTypes" ? values : (input as Row);
      const stored =
        texts && Object.keys(changes).some((k) => k in texts || k === "name" || k === "description")
          ? ((await client.request<Row>(`${base}/${id}`)).translations as Translations)
          : undefined;
      return flatten(
        await client.request<AdminModels[K]>(`${base}/${id}`, {
          method: "PUT",
          body: { ...unflatten(changes, entity, texts, stored), revision },
          ifMatch: revision,
        }),
        texts,
      );
    },
    async remove(id, revision) {
      await client.request<void>(`${base}/${id}`, {
        method: "DELETE",
        body: { revision },
        ifMatch: revision,
      });
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
