import { EntityManager } from "../../shared/entity-manager";
import { categoryConfig } from "../../products/config";
const config = categoryConfig("content", "Chuyên mục");
export default function Categories() {
  return <EntityManager config={config} />;
}
