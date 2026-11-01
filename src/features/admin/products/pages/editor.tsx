import { RecordEditor, useRecordId } from "../../shared/record-editor";
import { productConfig } from "../config";
export default function Editor() {
  const id = useRecordId();
  return (
    <RecordEditor config={productConfig} id={id || undefined} listHref="/admin/products/list" />
  );
}
