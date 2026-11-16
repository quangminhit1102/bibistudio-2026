import type { CategoryDto } from "./contracts";
export function categoryParentChoices(
  categories: CategoryDto[],
  movingId: string | null,
): Array<{ id: string | null; label: string; disabled: boolean; reason: string }> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  function ancestors(id: string) {
    const result = new Set<string>();
    let current = byId.get(id);
    while (current) {
      if (result.has(current.id)) break;
      result.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return result;
  }
  const descendants = new Set(
    movingId
      ? categories
          .filter((category) => ancestors(category.id).has(movingId))
          .map((category) => category.id)
      : [],
  );
  let height = 1;
  if (movingId)
    for (const id of descendants) {
      let current = byId.get(id),
        depth = 1;
      while (current?.parentId && current.id !== movingId) {
        depth++;
        current = byId.get(current.parentId);
        if (depth > categories.length) break;
      }
      height = Math.max(height, depth);
    }
  return [
    { id: null, label: "Không có danh mục cha", disabled: false, reason: "" },
    ...categories.map((category) => {
      const invalid = descendants.has(category.id),
        depth = ancestors(category.id).size,
        tooDeep = depth + height > 3;
      return {
        id: category.id,
        label: "— ".repeat(Math.max(0, depth - 1)) + category.name,
        disabled: invalid || tooDeep,
        reason: invalid
          ? "Không thể chọn chính danh mục hoặc danh mục con"
          : tooDeep
            ? "Danh mục tối đa 3 cấp"
            : "",
      };
    }),
  ];
}
