import { EntityManager } from "../../shared/entity-manager";
import { productTypeConfig } from "../config";
export default function ProductTypes() {
  return <EntityManager config={productTypeConfig} />;
}
