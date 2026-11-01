import { EntityManager } from "../../shared/entity-manager";
import { publisherConfig } from "../config";
export default function Publishers() {
  return <EntityManager config={publisherConfig} />;
}
