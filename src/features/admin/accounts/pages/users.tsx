import { EntityManager } from "../../shared/entity-manager";
import { userConfig } from "../config";
import { useAdmin } from "../../services/context";
import { ServerAccounts } from "../server-accounts";
export default function Users() {
  const runtime = useAdmin();
  if (runtime.http) return <ServerAccounts />;
  return <EntityManager config={userConfig} />;
}
