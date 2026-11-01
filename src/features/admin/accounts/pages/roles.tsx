import { EntityManager } from "../../shared/entity-manager";
import { roleConfig } from "../config";
export default function Roles() {
  return <EntityManager config={roleConfig} />;
}
