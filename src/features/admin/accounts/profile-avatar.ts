import { validateImageFile } from "../content/media/limits";
import { ServiceError } from "../services/errors";
export async function prepareAvatar(
  file: File,
): Promise<{ file: File; width: number; height: number }> {
  await validateImageFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ServiceError("validation", "Không đọc được ảnh. Hãy chọn ảnh khác.");
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000)
      throw new ServiceError("validation", "Ảnh tối đa40 triệu pixel.");
    return { file, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
export function ownedAvatarKey(userId: string, key: unknown): key is string {
  return typeof key === "string" && key.startsWith(`profile-avatar:${userId}:`);
}
