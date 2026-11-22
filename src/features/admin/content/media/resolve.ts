import type { AdminStore } from "../../services/contracts";
import type { AdminHttpClient } from "../../../../lib/admin-http";
export async function resolveMedia(
  store: AdminStore,
  id: string,
  http?: AdminHttpClient,
): Promise<{ url: string; release: () => void }> {
  const asset = await store.get("media", id);
  if (asset) {
    if (asset.url) {
      if (
        !/^\/(?!\/)/.test(asset.url) ||
        [...asset.url].some((c) => c === "\\" || c.charCodeAt(0) <= 32)
      )
        throw new Error("Đường dẫn ảnh không hợp lệ.");
      return { url: asset.url, release: () => {} };
    }
    const blob = await store.getBlob(asset.blobKey);
    if (!blob) throw new Error("Dữ liệu ảnh không còn trong trình duyệt.");
    const url = URL.createObjectURL(blob);
    let released = false;
    return {
      url,
      release: () => {
        if (!released) URL.revokeObjectURL(url);
        released = true;
      },
    };
  }
  if (!http) throw new Error("Không tìm thấy ảnh.");
  const blob = await http.requestBlob(`/api/media/${encodeURIComponent(id)}`);
  const url = URL.createObjectURL(blob);
  let released = false;
  return {
    url,
    release: () => {
      if (!released) URL.revokeObjectURL(url);
      released = true;
    },
  };
}
