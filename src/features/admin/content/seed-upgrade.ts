import type { AdminStore } from "../services/contracts";
import { seed } from "./seed";
export async function ensureContentMedia(store: AdminStore): Promise<void> {
  const marker = "editor:content-media:v1";
  if (await store.getMeta(marker)) return;
  const media = seed().media ?? [];
  await store.transaction(["media"], async (tx) => {
    for (const asset of media) if (!(await tx.get("media", asset.id))) await tx.put("media", asset);
  });
  await store.setMeta(marker, true);
}
