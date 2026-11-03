import ComposeForm, { type ComposeFormProps } from "../../shared/forms/compose-form";
export default function PostForm(props: ComposeFormProps) {
  return <ComposeForm {...props} kind="post" />;
}
