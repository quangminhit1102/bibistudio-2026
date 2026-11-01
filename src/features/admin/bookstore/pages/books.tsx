import { EntityManager } from "../../shared/entity-manager";
import { bookConfig } from "../config";
export default function BooksList() {
  return <EntityManager config={bookConfig} />;
}
