import { componentLabel } from "./labels";
import { componentUsage } from "./usage";
import { useState } from "react";
import { Tabs, ContextMenu, Menubar, Accordion } from "radix-ui";
import { Button, Modal, ActionMenu } from "../shared/ui/primitives";
import { Example } from "./example";
import { OverlayExample } from "./overlays";
import { componentCatalogue } from "./catalogue";
const sections = ["Sản phẩm", "Bài viết", "Báo cáo"];
export function NavigationExample({ name }: { name: string }) {
  const [selected, setSelected] = useState("Sản phẩm");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const portal = typeof document !== "undefined" ? document.querySelector(".admin-root") : null;
  if (name === "Command Palette") return <OverlayExample name="Command Dialog" />;
  if (name === "Dropdown Menu")
    return (
      <ActionMenu
        label="Chọn module"
        items={sections.map((label) => ({ label, onSelect: () => setSelected(label) }))}
      />
    );
  if (name === "Context Menu")
    return (
      <>
        <ContextMenu.Root>
          <ContextMenu.Trigger className="a-info-banner" tabIndex={0}>
            Nhấp chuột phải hoặc Shift+F10 để mở menu
          </ContextMenu.Trigger>
          <ContextMenu.Portal container={portal}>
            <ContextMenu.Content className="a-popover">
              {sections.map((v) => (
                <ContextMenu.Item key={v} className="a-menu-item" onSelect={() => setSelected(v)}>
                  {v}
                </ContextMenu.Item>
              ))}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
        <p role="status">Đã chọn: {selected}</p>
      </>
    );
  if (name === "Menubar")
    return (
      <>
        <Menubar.Root className="a-actions">
          {["Tệp", "Chỉnh sửa"].map((v) => (
            <Menubar.Menu key={v}>
              <Menubar.Trigger className="a-btn">{v}</Menubar.Trigger>
              <Menubar.Portal container={portal}>
                <Menubar.Content className="a-popover">
                  {["Tạo bản nháp", "Sao chép", "Lưu lại"].map((action) => (
                    <Menubar.Item
                      key={action}
                      className="a-menu-item"
                      onSelect={() => setSelected(action)}
                    >
                      {action}
                    </Menubar.Item>
                  ))}
                </Menubar.Content>
              </Menubar.Portal>
            </Menubar.Menu>
          ))}
        </Menubar.Root>
        <p role="status">{selected}</p>
      </>
    );
  if (name === "Tabs")
    return (
      <Tabs.Root defaultValue="Sản phẩm" style={{ width: "100%" }}>
        <Tabs.List aria-label="Module" className="a-actions">
          {sections.map((v) => (
            <Tabs.Trigger key={v} className="a-btn" value={v}>
              {v}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {sections.map((v) => (
          <Tabs.Content key={v} value={v}>
            <h3>{v}</h3>
            <p>Nội dung trong tab {v}.</p>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    );
  if (name === "Pagination")
    return (
      <>
        <nav className="a-actions" aria-label="Phân trang ví dụ">
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Trước
          </Button>
          {[1, 2, 3].map((v) => (
            <Button
              key={v}
              aria-current={v === page ? "page" : undefined}
              onClick={() => setPage(v)}
            >
              {v}
            </Button>
          ))}
          <Button disabled={page === 3} onClick={() => setPage(page + 1)}>
            Sau
          </Button>
        </nav>
        <p>
          Trang {page}: {sections[page - 1]}
        </p>
      </>
    );
  if (name === "Stepper")
    return (
      <>
        <ol className="a-actions" aria-label="Các bước xuất bản">
          {["Soạn thảo", "Kiểm tra", "Xuất bản"].map((v, i) => (
            <li key={v}>
              <Button
                aria-current={page === i + 1 ? "step" : undefined}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}. {v}
              </Button>
            </li>
          ))}
        </ol>
        <p>Bước {page} / 3</p>
        <Button onClick={() => setPage((v) => (v === 3 ? 1 : v + 1))}>
          {page === 3 ? "Bắt đầu lại" : "Tiếp tục"}
        </Button>
      </>
    );
  if (name === "Mobile Navigation Drawer")
    return (
      <>
        <Button onClick={() => setOpen(true)}>Mở menu mobile</Button>
        <Modal open={open} onOpenChange={setOpen} title="Module" placement="left">
          <div className="a-dialog-body">
            {sections.map((v) => (
              <Button
                key={v}
                onClick={() => {
                  setSelected(v);
                  setOpen(false);
                }}
              >
                {v}
              </Button>
            ))}
          </div>
        </Modal>
        <p>Đang xem: {selected}</p>
      </>
    );
  if (name === "Accordion")
    return (
      <Accordion.Root type="single" collapsible style={{ width: "100%" }}>
        {sections.map((v) => (
          <Accordion.Item key={v} value={v}>
            <Accordion.Header>
              <Accordion.Trigger className="a-btn">{v}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <p>Các công việc trong {v}. Nội dung có thể đóng hoặc mở bằng bàn phím.</p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    );
  if (name === "Tree View")
    return (
      <div
        role="tree"
        aria-label="Cây nội dung"
        onKeyDown={(e) => {
          const items = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]'),
          );
          const index = items.indexOf(document.activeElement as HTMLElement);
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            items[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? items.length - 1
                  : Math.max(
                      0,
                      Math.min(items.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)),
                    )
            ]?.focus();
          }
          if (e.key === "ArrowRight") setExpanded(true);
          if (e.key === "ArrowLeft") setExpanded(false);
        }}
      >
        <button role="treeitem" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          ▸ Bộ sưu tập Việt Nam
        </button>
        {expanded && (
          <div role="group">
            {["Đà Nẵng", "Hà Nội"].map((v) => (
              <button
                key={v}
                role="treeitem"
                aria-selected={selected === v}
                onClick={() => setSelected(v)}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        <p>Đang chọn: {selected}</p>
      </div>
    );
  if (["Collapsible", "Collapsible Navigation", "Details Panel"].includes(name))
    return (
      <details>
        <summary>{name === "Details Panel" ? "Chi tiết sản phẩm" : "Các module quản trị"}</summary>
        {name === "Details Panel" ? (
          <dl>
            <dt>SKU</dt>
            <dd>BIBI-001</dd>
            <dt>Trạng thái</dt>
            <dd>Bản nháp</dd>
          </dl>
        ) : (
          sections.map((v) => (
            <Button key={v} onClick={() => setSelected(v)}>
              {v}
            </Button>
          ))
        )}
        <p>{selected}</p>
      </details>
    );
  if (name === "Expandable List")
    return (
      <div>
        <ul>
          {(expanded ? [...sections, "Thư viện ảnh", "Người dùng"] : sections).map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
        <Button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Thu gọn" : "Xem thêm 2 mục"}
        </Button>
      </div>
    );
  if (name === "Breadcrumb")
    return (
      <nav aria-label="Breadcrumb ví dụ">
        <Button variant="link" onClick={() => setSelected("Workspace")}>
          Workspace
        </Button>{" "}
        /{" "}
        <Button variant="link" onClick={() => setSelected("Sản phẩm")}>
          Sản phẩm
        </Button>{" "}
        / <span aria-current="page">{selected}</span>
      </nav>
    );
  return (
    <div style={{ width: "100%" }}>
      <nav aria-label={name} className={name === "Sidebar" ? "a-example-sidebar" : "a-actions"}>
        {sections.map((v) => (
          <Button
            key={v}
            aria-current={selected === v ? "page" : undefined}
            onClick={() => setSelected(v)}
          >
            {v}
          </Button>
        ))}
      </nav>
      <p role="status">Nội dung đang xem: {selected}</p>
    </div>
  );
}
export default function Navigation() {
  return (
    <>
      {componentCatalogue.navigation.map((name) => (
        <Example
          key={name}
          name={name}
          description="Dùng Tab, Enter và phím mũi tên trong các menu/tab/cây nội dung."
          code={componentUsage("navigation", name)}
        >
          <NavigationExample name={name} />
        </Example>
      ))}
    </>
  );
}
