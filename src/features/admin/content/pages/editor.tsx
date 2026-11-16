import { useRecordId } from "../../shared/record-editor";
import ComposeEditor from "../../shared/forms/compose-editor";
import { useContent } from "../context";
import { ServerPostForm } from "../components/server-post-form";
import { useNavigate } from "@tanstack/react-router";
import { internalTarget } from "../../shared/lib/navigation";
export default function Editor() {
  const id = useRecordId();
  const { mode } = useContent(),
    navigate = useNavigate();
  return mode === "http" ? (
    <ServerPostForm
      id={id || undefined}
      onBack={() => void navigate(internalTarget("/admin/content/posts"))}
      onCreated={(created) =>
        void navigate(internalTarget("/admin/content/posts/" + created + "/edit"))
      }
    />
  ) : (
    <ComposeEditor entity="posts" id={id || undefined} />
  );
}
