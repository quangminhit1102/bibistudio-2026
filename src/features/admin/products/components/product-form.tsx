import ComposeForm, { type ComposeFormProps } from "../../shared/forms/compose-form";
export default function ProductForm(props: ComposeFormProps) {
  return <ComposeForm {...props} kind="product" />;
}
