import { EntityManager } from "../../shared/entity-manager";
import { authorConfig } from "../config";
export default function Authors() {
  return <EntityManager config={authorConfig} />;
}
