import type { AdminStore, EntityKey } from "../services/contracts";
import { legacyPresentationBaseline } from "./legacy-presentation";
const groups: Partial<Record<EntityKey, string>> = {
  products: "products",
  users: "accounts",
  customers: "business",
  posts: "content",
  visitors: "analytics",
};
export async function upgradePresentation(store: AdminStore, entity: EntityKey): Promise<void> {
  const group = groups[entity];
  if (!group) return;
  const marker = `presentation:${group}:v1`;
  if (await store.getMeta(marker)) return;
  const rows = await store.list(entity);
  const replacements: Record<string, Record<string, unknown>> = {};
  let media: import("../services/contracts").MediaAsset[] = [];
  if (entity === "products") {
    const { seed } = await import("../products/seed");
    const batch = seed();
    media = batch.media ?? [];
    for (const p of batch.products ?? [])
      replacements[p.id] = p as unknown as Record<string, unknown>;
  } else if (entity === "users") {
    const { seed } = await import("../accounts/seed");
    for (const u of seed().users ?? [])
      replacements[u.id] = u as unknown as Record<string, unknown>;
  } else if (entity === "customers") {
    const { seed } = await import("../sales/business-seed");
    for (const c of seed().customers ?? [])
      replacements[c.id] = c as unknown as Record<string, unknown>;
  } else if (entity === "visitors") {
    const { seed } = await import("../analytics/seed");
    for (const v of seed().visitors ?? [])
      replacements[v.id] = v as unknown as Record<string, unknown>;
  }
  await store.transaction([entity, ...(media.length ? ["media" as const] : [])], async (tx) => {
    for (const asset of media) if (!(await tx.get("media", asset.id))) await tx.put("media", asset);
    for (const row of rows) {
      const baseline = legacyPresentationBaseline(entity, row.id);
      if (!baseline) continue;
      const current = await tx.get(entity, row.id);
      if (!current) continue;
      const fields = current as unknown as Record<string, unknown>;
      const changed: Record<string, unknown> = {};
      for (const [field, old] of Object.entries(baseline)) {
        if (JSON.stringify(fields[field]) !== JSON.stringify(old)) continue;
        let replacement = replacements[row.id]?.[field];
        if (entity === "products" && field === "slug" && replacement === undefined)
          replacement = "san-pham-" + row.id;
        if (entity === "posts" && field === "slug") replacement = "bai-viet-" + row.id;
        if (entity === "posts" && field === "content")
          replacement = JSON.stringify({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Những câu chuyện và cảm hứng từ BiBi Studio." }],
              },
            ],
          });
        if (replacement !== undefined && JSON.stringify(replacement) !== JSON.stringify(old))
          changed[field] = replacement;
      }
      if (Object.keys(changed).length)
        await tx.put(entity, { ...current, ...changed, revision: current.revision + 1 });
    }
  });
  await store.setMeta(marker, true);
}
