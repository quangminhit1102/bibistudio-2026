import { RecordDetail, useRecordId } from "../../shared/record-editor";
import { postConfig } from "../config";
export default function Detail() {
  return <RecordDetail config={postConfig} id={useRecordId()} listHref="/admin/content/posts" />;
}
