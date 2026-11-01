import { EntityManager } from "../../shared/entity-manager";
import { customerConfig } from "../config";
export default function CustomerList() {
  return <EntityManager config={customerConfig} />;
}
