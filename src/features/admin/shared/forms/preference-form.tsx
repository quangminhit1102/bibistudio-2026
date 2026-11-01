import { useState, type ComponentProps } from "react";
import { RecordForm } from "./record-form";
import { useUnsavedChanges } from "./unsaved-guard";
import { ConfirmDialog } from "../ui/primitives";
export function UnsavedDialog({ dirty }: { dirty: boolean }) {
  const blocker = useUnsavedChanges(dirty);
  return (
    <ConfirmDialog
      open={blocker.status === "blocked"}
      title="Bỏ thay đổi chưa lưu?"
      description="Nội dung đang chỉnh sửa sẽ không được lưu."
      onCancel={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
export function PreferenceForm(
  props: Omit<ComponentProps<typeof RecordForm>, "onCancel" | "onDirtyChange">,
) {
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <>
      <RecordForm
        {...props}
        key={version}
        onDirtyChange={setDirty}
        onCancel={() => {
          if (dirty) setDiscard(true);
        }}
      />
      <UnsavedDialog dirty={dirty} />
      <ConfirmDialog
        open={discard}
        title="Bỏ thay đổi chưa lưu?"
        description="Khôi phục biểu mẫu về thông tin đã lưu."
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setDirty(false);
          setVersion((v) => v + 1);
          setDiscard(false);
        }}
      />
    </>
  );
}
