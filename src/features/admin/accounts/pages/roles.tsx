import { EntityManager } from "../../shared/entity-manager";
import { roleConfig } from "../config";
import { useAdmin } from "../../services/context";
import { ServerRoles } from "../server-roles";
export default function Roles() {
  const runtime = useAdmin();
  if (runtime.http) return <ServerRoles />;
  return <EntityManager config={roleConfig} />;
}
