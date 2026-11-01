import { RecordEditor, useRecordId } from "../../shared/record-editor";
import { bookConfig } from "../config";
export default function Editor() {
  const id = useRecordId();
  return (
    <RecordEditor config={bookConfig} id={id || undefined} listHref="/admin/bookstore/books" />
  );
}
