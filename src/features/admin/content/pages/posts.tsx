import { EntityManager } from "../../shared/entity-manager";
import { postConfig } from "../config";
import { useContent } from "../context";
import ServerPosts from "./server-posts";
export default function Posts() {
  const { mode } = useContent();
  return mode === "http" ? <ServerPosts /> : <EntityManager config={postConfig} />;
}
