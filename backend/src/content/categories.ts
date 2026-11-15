import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "../http/errors";
import { CONTENT_LIMITS } from "./limits";
export async function assertCategoryPlacement(
  c: PoolConnection,
  id: string,
  parentId: string | null,
) {
  const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id,parent_id FROM content_categories ORDER BY id FOR UPDATE",
    ),
    parents = new Map<string, string | null>(
      rows.map((row) => [String(row.id), row.parent_id ? String(row.parent_id) : null]),
    );
  if (parentId && !parents.has(parentId))
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy danh mục cha");
  parents.set(id, parentId);
  for (const start of parents.keys()) {
    const visited = new Set<string>();
    let current: string | null = start,
      depth = 0;
    while (current) {
      if (visited.has(current))
        throw new ApiError(400, "CATEGORY_CYCLE", "Danh mục không được tạo vòng lặp");
      visited.add(current);
      depth++;
      if (depth > CONTENT_LIMITS.categoryDepth)
        throw new ApiError(400, "CATEGORY_DEPTH", "Danh mục tối đa3cấp");
      current = parents.get(current) ?? null;
    }
  }
}
export async function assertDraftCategory(
  c: PoolConnection,
  id: string | null,
  previousId: string | null,
) {
  if (!id) return;
  let current: string | null = id;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) throw new ApiError(400, "CATEGORY_CYCLE", "Danh mục không hợp lệ");
    visited.add(current);
    const [rows]: [RowDataPacket[], unknown] = await c.execute<RowDataPacket[]>(
      "SELECT active,parent_id FROM content_categories WHERE id=?",
      [current],
    );
    const row: RowDataPacket | undefined = rows[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy danh mục");
    if (!row.active && id !== previousId)
      throw new ApiError(400, "CATEGORY_INACTIVE", "Không thể chọn danh mục đang ẩn cho bài mới");
    current = row.parent_id ? String(row.parent_id) : null;
  }
}
