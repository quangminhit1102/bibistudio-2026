import type { AdminStore } from "../../services/contracts";
export async function resolveMedia(store: AdminStore, id: string): Promise<{url:string;release:()=>void}> {
  const asset = await store.get("media", id);
  if (!asset) throw new Error("Không tìm thấy ảnh.");
  if (asset.url) {
    if (!/^\/(?!\/)/.test(asset.url) || /[\\\u0000-\u0020]/.test(asset.url)) throw new Error("Đường dẫn ảnh không hợp lệ.");
    return { url: asset.url, release: () => {} };
  }
  const blob = await store.getBlob(asset.blobKey);
  if (!blob) throw new Error("Dữ liệu ảnh không còn trong trình duyệt.");
  const url = URL.createObjectURL(blob);
  let released = false;
  return { url, release: () => { if (!released) URL.revokeObjectURL(url); released = true; } };
}
