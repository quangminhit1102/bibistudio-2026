import { EntityManager } from "../../shared/entity-manager";
import { productConfig } from "../config";
export default function ProductsList() {
  return <EntityManager config={productConfig} />;
}
