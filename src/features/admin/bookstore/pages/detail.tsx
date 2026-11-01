import { RecordDetail, useRecordId } from "../../shared/record-editor";
import { bookConfig } from "../config";
export default function Detail() {
  return <RecordDetail config={bookConfig} id={useRecordId()} listHref="/admin/bookstore/books" />;
}
