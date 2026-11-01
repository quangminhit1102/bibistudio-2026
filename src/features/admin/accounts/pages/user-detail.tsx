import { RecordDetail, useRecordId } from "../../shared/record-editor";
import { userConfig } from "../config";
export default function UserDetail() {
  return <RecordDetail config={userConfig} id={useRecordId()} listHref="/admin/accounts/users" />;
}
