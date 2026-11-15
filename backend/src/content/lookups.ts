import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Clock } from "../config";
import type { AuthPrincipal } from "../auth/service";
import type { Page } from "../http/contracts";
import { ApiError } from "../http/errors";
import { withTransaction } from "../db/transaction";
import { lockAuthorizedUsers } from "../authorization/transaction";
import { assertContentSchemaReady } from "./schema";
import { jsonValue } from "./repository";
import type { CategoryInput } from "./contracts";
export interface ContentLookupInput {
  page: number;
  pageSize: number;
  search?: string;
}
export interface AuthorChoice {
  id: string;
  name: string;
  kind: "brand" | "account";
}
export interface CategoryChoice {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
}
export function createContentLookups({ pool, clock }: { pool: Pool; clock: Clock }) {
  async function read<T>(
    actor: AuthPrincipal,
    input: ContentLookupInput,
    work: (c: PoolConnection) => Promise<T>,
  ) {
    if (
      !Number.isInteger(input.page) ||
      input.page < 1 ||
      input.page > 1000000 ||
      !Number.isInteger(input.pageSize) ||
      input.pageSize < 1 ||
      input.pageSize > 100 ||
      (input.search?.length ?? 0) > 100
    )
      throw new ApiError(400, "INVALID_CONTENT_INPUT", "Bộ lọc không hợp lệ");
    return withTransaction(pool, async (c) => {
      await lockAuthorizedUsers(c, actor, "post.view", clock);
      await assertContentSchemaReady(c);
      return work(c);
    });
  }
  return {
    authors(actor: AuthPrincipal, input: ContentLookupInput): Promise<Page<AuthorChoice>> {
      return read(actor, input, async (c) => {
        const search = input.search ?? "",
          like = `%${search}%`,
          [[count]] = await c.execute<RowDataPacket[]>(
            "SELECT COUNT(*) total FROM users WHERE active=1 AND deleted_at IS NULL AND display_name LIKE ?",
            [like],
          );
        const brand: AuthorChoice = { id: "brand", name: "BiBi Studio", kind: "brand" },
          includeBrand = brand.name
            .toLocaleLowerCase("vi")
            .includes(search.toLocaleLowerCase("vi")),
          offset = (input.page - 1) * input.pageSize,
          firstBrand = includeBrand && offset === 0;
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,display_name FROM users WHERE active=1 AND deleted_at IS NULL AND display_name LIKE ? ORDER BY display_name,id LIMIT ? OFFSET ?",
          [
            like,
            input.pageSize - (firstBrand ? 1 : 0),
            Math.max(0, offset - (includeBrand ? 1 : 0)),
          ],
        );
        return {
          items: [
            ...(firstBrand ? [brand] : []),
            ...rows.map((row) => ({
              id: String(row.id),
              name: String(row.display_name),
              kind: "account" as const,
            })),
          ],
          total: Number(count.total) + (includeBrand ? 1 : 0),
          page: input.page,
          pageSize: input.pageSize,
        };
      });
    },
    tags(
      actor: AuthPrincipal,
      input: ContentLookupInput,
    ): Promise<Page<{ id: string; name: string }>> {
      return read(actor, input, async (c) => {
        const like = `%${input.search ?? ""}%`,
          [[count]] = await c.execute<RowDataPacket[]>(
            "SELECT COUNT(*) total FROM content_tags WHERE name LIKE ?",
            [like],
          ),
          [rows] = await c.query<RowDataPacket[]>(
            "SELECT id,name FROM content_tags WHERE name LIKE ? ORDER BY normalized_name,id LIMIT ? OFFSET ?",
            [like, input.pageSize, (input.page - 1) * input.pageSize],
          );
        return {
          items: rows.map((row) => ({ id: String(row.id), name: String(row.name) })),
          total: Number(count.total),
          page: input.page,
          pageSize: input.pageSize,
        };
      });
    },
    categoryChoices(
      actor: AuthPrincipal,
      input: ContentLookupInput,
    ): Promise<Page<CategoryChoice> & { ancestors: CategoryChoice[] }> {
      return read(actor, input, async (c) => {
        const [rows] = await c.query<RowDataPacket[]>(
            "SELECT id,parent_id,active,draft_json FROM content_categories ORDER BY position,id",
          ),
          all = new Map<string, CategoryChoice>(
            rows.map((row) => {
              const value = jsonValue<CategoryInput>(row.draft_json);
              return [
                String(row.id),
                {
                  id: String(row.id),
                  name: value.name,
                  parentId: row.parent_id ? String(row.parent_id) : null,
                  active: Boolean(row.active),
                },
              ];
            }),
          );
        const visible = [...all.values()].filter((value) => {
          let current: CategoryChoice | undefined = value;
          const seen = new Set<string>();
          while (current) {
            if (!current.active || seen.has(current.id)) return false;
            seen.add(current.id);
            current = current.parentId ? all.get(current.parentId) : undefined;
          }
          return value.name
            .toLocaleLowerCase("vi")
            .includes((input.search ?? "").toLocaleLowerCase("vi"));
        });
        const items = visible.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
          ancestors = new Map<string, CategoryChoice>();
        for (const item of items) {
          let current = item.parentId ? all.get(item.parentId) : undefined;
          const seen = new Set<string>();
          while (current && !seen.has(current.id)) {
            seen.add(current.id);
            ancestors.set(current.id, current);
            current = current.parentId ? all.get(current.parentId) : undefined;
          }
        }
        return {
          items,
          total: visible.length,
          page: input.page,
          pageSize: input.pageSize,
          ancestors: [...ancestors.values()],
        };
      });
    },
  };
}
export type ContentLookups = ReturnType<typeof createContentLookups>;
