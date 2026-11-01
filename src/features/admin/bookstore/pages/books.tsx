import { EntityManager } from "../../shared/entity-manager";
import { bookConfig } from "../config";
import { useEntity } from "../../services/context";
export default function BooksList() {
  const authors = useEntity("authors", { page: 1, pageSize: 200 });
  const publishers = useEntity("publishers", { page: 1, pageSize: 200 });
  const genres = useEntity(
    "categories",
    { page: 1, pageSize: 200, filters: { kind: "genre" } },
    "bookstore",
  );
  const options = (rows: { id: string; name: string }[] | undefined) =>
    rows?.map((r) => ({ value: r.id, label: r.name })) ?? [];
  return (
    <EntityManager
      config={{
        ...bookConfig,
        filters: [
          ...(bookConfig.filters ?? []),
          { field: "authorIds", label: "Tác giả", options: options(authors.data?.items) },
          { field: "publisherId", label: "Nhà xuất bản", options: options(publishers.data?.items) },
          { field: "genreIds", label: "Thể loại", options: options(genres.data?.items) },
          {
            field: "availability",
            label: "Tồn khả dụng",
            options: [
              { value: "in-stock", label: "Còn hàng" },
              { value: "out-of-stock", label: "Hết hàng" },
            ],
          },
        ],
      }}
    />
  );
}
