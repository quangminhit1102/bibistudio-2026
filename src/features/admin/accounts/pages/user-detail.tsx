import { RecordDetail, useRecordId } from "../../shared/record-editor";
import { userConfig } from "../config";
import { useAdmin } from "../../services/context";
import { ServerAccountDetail } from "../server-account-detail";
export default function UserDetail() {
  const runtime = useAdmin();
  const id = useRecordId();
  if (runtime.http) return <ServerAccountDetail key={id} id={id} />;
  return <RecordDetail config={userConfig} id={id} listHref="/admin/accounts/users" />;
}
