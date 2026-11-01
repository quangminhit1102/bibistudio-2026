import { componentUsage } from "./usage";
import { useState } from "react";
import { Popover, HoverCard, AlertDialog } from "radix-ui";
import { Button, Modal, ConfirmDialog, Tooltip, ActionMenu } from "../shared/ui/primitives";
import { Example } from "./example";
import { componentCatalogue } from "./catalogue";
export function OverlayExample({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("");
  const [q, setQ] = useState("");
  const [text, setText] = useState("Bản nháp");
  const portal = typeof document !== "undefined" ? document.querySelector(".admin-root") : null;
  const body = (
    <div className="a-dialog-body">
      <p>Xem lại nội dung rồi xác nhận thao tác demo.</p>
      <label className="a-field">
        Tên bản nháp
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <Button
        variant="primary"
        onClick={() => {
          setResult("Đã lưu " + text);
          setOpen(false);
        }}
      >
        Lưu bản nháp
      </Button>
    </div>
  );
  let content;
  if (name === "Tooltip")
    content = (
      <Tooltip label="Nhấn để đánh dấu nội dung cần xem lại">
        <Button onClick={() => setResult("Đã đánh dấu xem lại")}>Di chuột hoặc focus</Button>
      </Tooltip>
    );
  else if (name === "Dropdown Menu")
    content = (
      <ActionMenu
        label="Thao tác bản nháp"
        items={["Sao chép", "Lưu nháp", "Lưu trữ"].map((label) => ({
          label,
          onSelect: () => setResult(label),
        }))}
      />
    );
  else if (name === "Popover")
    content = (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button>Chỉnh nhanh</Button>
        </Popover.Trigger>
        <Popover.Portal container={portal}>
          <Popover.Content className="a-popover" sideOffset={8}>
            {body}
            <Popover.Close asChild>
              <Button variant="ghost">Đóng</Button>
            </Popover.Close>
            <Popover.Arrow />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  else if (name === "Hover Card")
    content = (
      <HoverCard.Root>
        <HoverCard.Trigger asChild>
          <a href="#profile-preview" onClick={(e) => e.preventDefault()}>
            Xem hồ sơ Minh Nguyễn
          </a>
        </HoverCard.Trigger>
        <HoverCard.Portal container={portal}>
          <HoverCard.Content className="a-popover" sideOffset={8}>
            <strong>Minh Nguyễn</strong>
            <p>Biên tập catalogue · BiBi Studio</p>
            <span>Hồ sơ demo</span>
            <HoverCard.Arrow />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    );
  else if (name === "Alert Dialog")
    content = (
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Trigger asChild>
          <Button variant="destructive">Xóa bản nháp demo</Button>
        </AlertDialog.Trigger>
        <AlertDialog.Portal container={portal}>
          <AlertDialog.Overlay className="a-overlay" />
          <AlertDialog.Content className="a-modal">
            <AlertDialog.Title>Xóa bản nháp?</AlertDialog.Title>
            <AlertDialog.Description>Thao tác chỉ thay đổi ví dụ này.</AlertDialog.Description>
            <div className="a-actions">
              <AlertDialog.Cancel asChild>
                <Button>Hủy</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="destructive" onClick={() => setResult("Đã xóa bản nháp demo")}>
                  Xác nhận xóa
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    );
  else if (name === "Confirmation Dialog")
    content = (
      <>
        <Button onClick={() => setOpen(true)}>Xác nhận xuất bản</Button>
        <ConfirmDialog
          open={open}
          title="Xuất bản bản nháp demo?"
          description="Không cập nhật nội dung website thật."
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setResult("Đã xuất bản demo");
            setOpen(false);
          }}
        />
      </>
    );
  else
    content = (
      <>
        <Button onClick={() => setOpen(true)}>Mở {name}</Button>
        <Modal
          placement={name === "Drawer" ? "left" : name === "Sheet" ? "right" : "center"}
          open={open}
          onOpenChange={setOpen}
          title={name}
          description="Escape để đóng, Tab giữ focus trong hộp thoại."
        >
          {name === "Command Dialog" ? (
            <div className="a-dialog-body">
              <input
                autoFocus
                aria-label="Tìm lệnh"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm hành động…"
              />
              {["Tạo sản phẩm", "Tạo bài viết", "Xem báo cáo"]
                .filter((v) => v.toLocaleLowerCase("vi").includes(q.toLocaleLowerCase("vi")))
                .map((v) => (
                  <Button
                    key={v}
                    onClick={() => {
                      setResult(v);
                      setOpen(false);
                    }}
                  >
                    {v}
                  </Button>
                ))}
            </div>
          ) : (
            <div className={name === "Drawer" || name === "Sheet" ? "a-sheet-body" : ""}>
              {body}
            </div>
          )}
        </Modal>
      </>
    );
  return (
    <>
      {content}
      <small role="status">{result}</small>
    </>
  );
}
export default function Overlays() {
  return (
    <>
      {componentCatalogue.overlays.map((name) => (
        <Example
          key={name}
          name={name}
          description="Hỗ trợ focus, Escape và quay lại nút mở. Thao tác chỉ ảnh hưởng ví dụ."
          code={componentUsage("overlays", name)}
        >
          <OverlayExample name={name} />
        </Example>
      ))}
    </>
  );
}
