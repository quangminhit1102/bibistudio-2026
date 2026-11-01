import { RecordEditor, useRecordId } from "../../shared/record-editor";
import { postConfig } from "../config";
export default function Editor() {
  const id = useRecordId();
  return <RecordEditor config={postConfig} id={id || undefined} listHref="/admin/content/posts" />;
}
