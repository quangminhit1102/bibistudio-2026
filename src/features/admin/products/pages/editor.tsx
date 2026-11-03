import { useRecordId } from "../../shared/record-editor";
import ComposeEditor from "../../shared/forms/compose-editor";
export default function Editor() {
  const id = useRecordId();
  return <ComposeEditor entity="products" id={id || undefined} />;
}
