import { EntityManager } from "../../shared/entity-manager";
import { categoryConfig } from "../../products/config";
const config = categoryConfig("product", "Danh mục sản phẩm");
export default function Categories() {
  return <EntityManager config={config} />;
}
