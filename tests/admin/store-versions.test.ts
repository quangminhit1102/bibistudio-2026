import "fake-indexeddb/auto";
import { openDB } from "idb";
import { expect, it } from "vitest";
import { createAdminStore } from "../../src/features/admin/demo/store";
import { entityKeys } from "../../src/features/admin/services/contracts";

// What a release from before product types existed leaves in the browser.
async function olderRelease(name: string) {
  const db = await openDB(name, 2, {
    upgrade(d) {
      for (const entity of entityKeys)
        if (entity !== "productTypes" && !d.objectStoreNames.contains(entity))
          d.createObjectStore(entity, { keyPath: "id" });
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
      if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs");
    },
  });
  const version = db.version;
  db.close();
  return version;
}

it("leaves an older release's database openable until a new entity is stored", async () => {
  const name = "store-versions-" + crypto.randomUUID();
  await olderRelease(name);
  const store = createAdminStore(name);
  const slip = { id: "s1" } as never;
  await store.transaction(entityKeys, async (tx) => {
    await tx.put("purchaseSlips", slip);
    expect(await tx.list("productTypes")).toEqual([]);
  });
  expect(await store.list("productTypes")).toEqual([]);
  await store.close();
  // Rolled back: the older release still opens the same database and finds its data.
  expect(await olderRelease(name)).toBe(2);

  await store.prepare!(["productTypes"]);
  await store.transaction(["productTypes"], (tx) => tx.put("productTypes", { id: "t1" } as never));
  expect(await store.list("productTypes")).toEqual([{ id: "t1" }]);
  expect(await store.list("purchaseSlips")).toEqual([{ id: "s1" }]);
  await store.close();

  // A later visit reopens the upgraded database without asking for a version.
  const again = createAdminStore(name);
  expect(await again.list("productTypes")).toEqual([{ id: "t1" }]);
  await again.destroy();
});

it("a new browser gets every entity at the version all releases open", async () => {
  const name = "store-versions-" + crypto.randomUUID();
  const store = createAdminStore(name);
  await store.prepare!(["productTypes"]);
  await store.transaction(["productTypes"], (tx) => tx.put("productTypes", { id: "t1" } as never));
  await store.close();
  expect(await olderRelease(name)).toBe(2);
  await store.destroy();
});
