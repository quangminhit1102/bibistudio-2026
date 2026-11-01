import { RecordDetail, useRecordId } from "../../shared/record-editor";
import { productConfig } from "../config";
export default function Detail() {
  return <RecordDetail config={productConfig} id={useRecordId()} listHref="/admin/products/list" />;
}
