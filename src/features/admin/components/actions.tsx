import { componentUsage } from "./usage";
import { useState } from "react";
import { Plus, Heart, ChevronDown } from "lucide-react";
import { Button, ActionMenu, type ButtonVariant } from "../shared/ui/primitives";
import { Example, copyText } from "./example";
import { componentCatalogue } from "./catalogue";
export function ActionExample({ name }: { name: string }) {
  const [pressed, setPressed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const run = () => {
    setCount((c) => c + 1);
    setMessage("Đã thực hiện hành động demo.");
  };
  let preview;
  if (name === "Toggle Button")
    preview = (
      <Button aria-pressed={pressed} onClick={() => setPressed(!pressed)}>
        <Heart size={16} fill={pressed ? "currentColor" : "none"} />
        Theo dõi
      </Button>
    );
  else if (name === "Copy Button")
    preview = (
      <Button
        onClick={async () => {
          try {
            await copyText("BiBi Studio");
            setMessage("Đã sao chép BiBi Studio.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        Sao chép tên
      </Button>
    );
  else if (name === "Loading Button")
    preview = (
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await new Promise((r) => setTimeout(r, 500));
          run();
          setBusy(false);
        }}
      >
        Lưu demo
      </Button>
    );
  else if (name === "Dropdown Button" || name === "Split Button")
    preview = (
      <div className="a-actions">
        {name === "Split Button" && <Button onClick={run}>Tạo bản nháp</Button>}
        <ActionMenu
          label="Tùy chọn"
          items={["Lưu bản nháp", "Xuất bản demo", "Xem trước"].map((label) => ({
            label,
            onSelect: () => {
              setMessage(label);
              setCount((c) => c + 1);
            },
          }))}
        />
      </div>
    );
  else if (name === "Icon Button")
    preview = (
      <Button size="icon" aria-label="Thêm mục demo" onClick={run}>
        <Plus size={17} />
      </Button>
    );
  else if (name === "Button Group")
    preview = (
      <div className="a-actions" role="group" aria-label="Khoảng thời gian">
        {["Ngày", "Tuần", "Tháng"].map((v) => (
          <Button key={v} aria-pressed={message === v} onClick={() => setMessage(v)}>
            {v}
          </Button>
        ))}
      </div>
    );
  else
    preview = (
      <div className="a-actions">
        {(
          ["primary", "secondary", "outline", "ghost", "destructive", "link"] as ButtonVariant[]
        ).map((v) => (
          <Button key={v} variant={v} onClick={run}>
            {v}
          </Button>
        ))}
        {(["sm", "md", "lg"] as const).map((size) => (
          <Button key={size} size={size} onClick={run}>
            {size}
          </Button>
        ))}
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>
    );
  return (
    <>
      <div>{preview}</div>
      <small role="status">
        {message}
        {count > 0 ? ` · ${count} lần` : ""}
      </small>
    </>
  );
}
export default function Actions() {
  return (
    <>
      {componentCatalogue.actions.map((name) => (
        <Example
          key={name}
          name={name}
          description="Hỗ trợ bàn phím, focus rõ, kích thước và trạng thái phù hợp với thao tác."
          code={componentUsage("actions", name)}
        >
          <ActionExample name={name} />
        </Example>
      ))}
    </>
  );
}
