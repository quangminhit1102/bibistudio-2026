import { EntityManager } from "../../shared/entity-manager";
import { postConfig } from "../config";
export default function Posts() {
  return <EntityManager config={postConfig} />;
}
