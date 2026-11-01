import { EntityManager } from "../../shared/entity-manager";
import { categoryConfig } from "../../products/config";
const config = categoryConfig("genre", "Thể loại sách");
export default function Categories() {
  return <EntityManager config={config} />;
}
