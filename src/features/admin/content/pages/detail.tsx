import { RecordDetail, useRecordId } from "../../shared/record-editor";
import { postConfig } from "../config";
import { useContent } from "../context";
import { ServerPostForm } from "../components/server-post-form";
export default function Detail() {
  const { mode } = useContent(),
    id = useRecordId();
  return mode === "http" ? (
    <ServerPostForm readOnly id={id} />
  ) : (
    <RecordDetail config={postConfig} id={id} listHref="/admin/content/posts" />
  );
}
