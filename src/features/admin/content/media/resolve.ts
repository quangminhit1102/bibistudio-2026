import type { AdminStore } from "../../services/contracts";
import type { AdminHttpClient } from "../../../../lib/admin-http";
function publicPath(url: string): string {
  if (!/^\/(?!\/)/.test(url) || [...url].some((c) => c === "\\" || c.charCodeAt(0) <= 32))
    throw new Error("Đường dẫn ảnh không hợp lệ.");
  return url;
}
export async function resolveMedia(
  store: AdminStore,
  id: string,
  http?: AdminHttpClient,
): Promise<{ url: string; release: () => void }> {
  // A seeded product or post names a public file of the site instead of a media id.
  if (id.startsWith("/")) return { url: publicPath(id), release: () => {} };
  const asset = await store.get("media", id);
  if (asset) {
    if (asset.url) return { url: publicPath(asset.url), release: () => {} };
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
