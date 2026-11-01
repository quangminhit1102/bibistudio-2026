import { openDB, deleteDB, type IDBPDatabase } from "idb";
import {
  entityKeys,
  type AdminStore,
  type AdminTransaction,
  type AdminModels,
  type EntityKey,
} from "../services/contracts";
import { storageError, ServiceError } from "../services/errors";
export function createAdminStore(name = "bibi-admin-demo"): AdminStore {
  let generation = 0;
  let connection: Promise<IDBPDatabase> | undefined;
  const db = () =>
    (connection ??= (async () => {
      try {
        return await openDB(name, 1, {
          upgrade(d) {
            for (const entity of entityKeys) d.createObjectStore(entity, { keyPath: "id" });
            d.createObjectStore("meta");
            d.createObjectStore("blobs");
          },
          blocking() {
            void close();
          },
        });
      } catch (e) {
        connection = undefined;
        throw storageError(e);
      }
    })());
  async function close() {
    if (connection) {
      (await connection).close();
      connection = undefined;
    }
  }
  return {
    get generation() {
      return generation;
    },
    invalidateOperations() {
      generation++;
    },
    async get<K extends EntityKey>(entity: K, id: string) {
      try {
        return (await (await db()).get(entity, id)) as AdminModels[K] | undefined;
      } catch (e) {
        throw storageError(e);
      }
    },
    async list<K extends EntityKey>(entity: K) {
      try {
        return (await (await db()).getAll(entity)) as AdminModels[K][];
      } catch (e) {
        throw storageError(e);
      }
    },
    async transaction<T>(entities: EntityKey[], work: (tx: AdminTransaction) => Promise<T>) {
      const operationGeneration = generation;
      const tx = (await db()).transaction(
        [...new Set([...entities, ...(entities.includes("media") ? ["blobs"] : [])])],
        "readwrite",
      );
      const api: AdminTransaction = {
        get: async (e, id) => await tx.objectStore(e).get(id),
        list: async (e) => await tx.objectStore(e).getAll(),
        put: async (e, r) => {
          await tx.objectStore(e).put(r);
        },
        remove: async (e, id) => {
          if (e === "media") {
            const asset = await tx.objectStore(e).get(id);
            if (asset?.blobKey) await tx.objectStore("blobs").delete(asset.blobKey);
          }
          await tx.objectStore(e).delete(id);
        },
      };
      try {
        const result = await work(api);
        if (operationGeneration !== generation)
          throw new ServiceError("aborted", "Phiên thay đổi trong khi lưu.");
        await tx.done;
        return result;
      } catch (e) {
        try {
          tx.abort();
        } catch {
          /* already aborted */
        }
        await tx.done.catch(() => {});
        throw storageError(e);
      }
    },
    async reset() {
      generation++;
      await close();
      await deleteDB(name);
    },
    close,
    async destroy() {
      await close();
      await deleteDB(name);
    },
    async getMeta(key) {
      return (await db()).get("meta", key);
    },
    async setMeta(key, value) {
      try {
        await (await db()).put("meta", value, key);
      } catch (e) {
        throw storageError(e);
      }
    },
    async importMedia(records, actor = "demo") {
      const operationGeneration = generation;
      const tx = (await db()).transaction(["media", "blobs", "audit"], "readwrite");
      try {
        for (const item of records) {
          await tx.objectStore("blobs").put(item.blob, item.asset.blobKey);
          await tx.objectStore("media").put(item.asset);
          const now = new Date().toISOString();
          await tx.objectStore("audit").put({
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            revision: 1,
            actor,
            resource: "media",
            action: "import",
            recordId: item.asset.id,
            before: "null",
            after: JSON.stringify(item.asset),
          });
        }
        if (operationGeneration !== generation)
          throw new ServiceError("aborted", "Phiên thay đổi trong khi nhập ảnh.");
        await tx.done;
      } catch (e) {
        try {
          tx.abort();
        } catch {
          /* inactive */
        }
        await tx.done.catch(() => {});
        throw storageError(e);
      }
    },
    async putBlob(key, value) {
      try {
        await (await db()).put("blobs", value, key);
      } catch (e) {
        throw storageError(e);
      }
    },
    async getBlob(key) {
      return (await db()).get("blobs", key);
    },
    async removeBlob(key) {
      await (await db()).delete("blobs", key);
    },
  };
}
