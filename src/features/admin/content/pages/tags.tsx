import { EntityManager } from "../../shared/entity-manager";
import { tagConfig } from "../config";
import { useContent } from "../context";
export default function Tags() {
  const { mode } = useContent();
  return mode === "http" ? (
    <p className="a-banner">Thêm và sửa thẻ ngay trong form bài viết.</p>
  ) : (
    <EntityManager config={tagConfig} />
  );
}
