import { EntityManager } from "../../shared/entity-manager";
import { categoryConfig } from "../../products/config";
import { useContent } from "../context";
import ServerCategories from "./server-categories";
const config = categoryConfig("content", "Chuyên mục");
export default function Categories() {
  const { mode } = useContent();
  return mode === "http" ? <ServerCategories /> : <EntityManager config={config} />;
}
