import type { AdminStore, DemoSession, MediaAsset } from "../../services/contracts";
import { requirePermission } from "../../accounts/permissions";
import { ServiceError } from "../../services/errors";
import { validateImageFile } from "./limits";
export function createMediaService(store: AdminStore, session: () => DemoSession | null) {
  return {
    async import(files: File[]) {
      const s = session();
      requirePermission(s, "content", "create", s ? await store.get("roles", s.roleId) : undefined);
      if (files.length > 10) throw new ServiceError("validation", "Tối đa10 ảnh mỗi lần nhập.");
      const prepared: { asset: MediaAsset; blob: Blob }[] = [];
      for (const file of files) {
        await validateImageFile(file);
        const image = await createImageBitmap(file);
        if (!image.width || image.width * image.height > 40000000) {
          image.close();
          throw new ServiceError(
            "validation",
            "Ảnh quá lớn hoặc không hợp lệ (tối đa40 megapixel).",
          );
        }
        const now = new Date().toISOString(),
          id = crypto.randomUUID();
        prepared.push({
          asset: {
            id,
            name: file.name,
            mime: file.type,
            size: file.size,
            width: image.width,
            height: image.height,
            blobKey: id,
            createdAt: now,
            updatedAt: now,
            revision: 1,
          },
          blob: file,
        });
        image.close();
      }
      await store.importMedia(prepared);
      return prepared.map((p) => p.asset);
    },
    async openBlob(id: string) {
      const asset = await store.get("media", id);
      if (!asset) throw new ServiceError("not-found", "Không tìm thấy ảnh.");
      const blob = await store.getBlob(asset.blobKey);
      if (!blob) throw new ServiceError("storage", "Dữ liệu ảnh không còn trong trình duyệt.");
      return blob;
    },
  };
}
