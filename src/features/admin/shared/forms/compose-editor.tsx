import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
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
  const opened = useRef<string | null>(null);
  const draftKey = `${entity}-${id ?? "new"}`;
  if (session.hasDraft && !session.loading && !session.error && session.canEdit)
    opened.current = draftKey;
  if (opened.current !== draftKey) {
    if (session.error) return <ErrorState error={session.error} onRetry={session.retry} />;
    if (session.loading) return <Skeleton />;
    if (!session.canEdit)
      return <ErrorState error={new Error("Bạn không có quyền chỉnh sửa dữ liệu này.")} />;
  }
  const Form = entity === "posts" ? PostForm : ProductForm;
  return (
    <>
      {session.error && <ErrorState error={session.error} onRetry={session.retry} />}
      {!session.canEdit && (
        <p role="alert" className="a-compose-error">
          Quyền chỉnh sửa đã thay đổi. Bản nháp được giữ trong form; bạn vẫn có thể xem trước.
        </p>
      )}
      <Form
        key={draftKey}
        writeBlocked={!session.canEdit || Boolean(session.error)}
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
