import { EntityManager } from "../../shared/entity-manager";
import { userConfig } from "../config";
export default function Users() {
  return <EntityManager config={userConfig} />;
}
