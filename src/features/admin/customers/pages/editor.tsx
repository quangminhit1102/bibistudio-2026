import { useSearch } from "@tanstack/react-router";
import { RecordEditor, useRecordId } from "../../shared/record-editor";
import { customerConfig, customerReturnTo } from "../config";
export default function CustomerEditor() {
  const id = useRecordId();
  const search = useSearch({ strict: false }) as { returnTo?: unknown };
  return (
    <RecordEditor
      config={customerConfig}
      id={id || undefined}
      listHref={customerReturnTo(search.returnTo)}
    />
  );
}
