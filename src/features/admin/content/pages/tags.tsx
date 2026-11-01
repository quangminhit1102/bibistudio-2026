import { EntityManager } from "../../shared/entity-manager";
import { tagConfig } from "../config";
export default function Tags() {
  return <EntityManager config={tagConfig} />;
}
