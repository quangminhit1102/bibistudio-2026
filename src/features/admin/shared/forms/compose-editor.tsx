import { useNavigate } from "@tanstack/react-router";
import PostForm from "../../content/components/post-form";
import ProductForm from "../../products/components/product-form";
import { ConfirmDialog, ErrorState, Skeleton, useNotice } from "../ui/primitives";
import { useEditorSession } from "./editor-session";
import { internalTarget } from "../lib/navigation";
export default function ComposeEditor({
  entity,
  id,
}: {
  entity: "posts" | "products";
  id?: string;
}) {
  const session = useEditorSession(entity, id),
    navigate = useNavigate(),
    notice = useNotice();
  const listHref = entity === "posts" ? "/admin/content/posts" : "/admin/products/list";
  if (session.error) return <ErrorState error={session.error} onRetry={session.retry} />;
  if (session.loading) return <Skeleton />;
  if (!session.canEdit)
    return <ErrorState error={new Error("Bạn không có quyền chỉnh sửa dữ liệu này.")} />;
  const Form = entity === "posts" ? PostForm : ProductForm;
  return (
    <>
      <Form
        key={`${entity}-${id ?? "new"}`}
        initial={session.initial}
        onDirtyChange={session.dirtyChanged}
        onCancel={() => void navigate(internalTarget(listHref))}
        onSave={async (values) => {
          await session.save(values);
          notice("Đã lưu dữ liệu.");
          void navigate(internalTarget(listHref));
        }}
      />
      <ConfirmDialog
        open={session.blocker.status === "blocked"}
        title="Bỏ thay đổi chưa lưu?"
        description="Nội dung đang chỉnh sửa sẽ không được lưu."
        onCancel={() => session.blocker.reset?.()}
        onConfirm={() => session.blocker.proceed?.()}
      />
    </>
  );
}
