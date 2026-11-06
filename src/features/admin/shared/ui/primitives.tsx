import {
  createContext,
  forwardRef,
  useContext,
  useState,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Dialog, DropdownMenu, Tooltip as RadixTooltip } from "radix-ui";
import { X, LoaderCircle, MoreHorizontal, Check, AlertCircle } from "lucide-react";
import { AdminThemeContext } from "./admin-theme";
import type { BadgeTone } from "./status-badges";
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg" | "icon";
    loading?: boolean;
  }
>(
  (
    { children, variant = "outline", size = "md", loading, className = "", disabled, ...props },
    ref,
  ) => (
    <button
      {...props}
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled || loading}
      className={`a-btn a-btn-${variant} a-btn-${size} ${className}`}
    >
      {loading && <LoaderCircle size={15} className="a-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "AdminButton";
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`a-badge a-badge-${tone}`}>{children}</span>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`a-card ${className}`}>{children}</section>;
}
export function PageTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="a-page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="a-actions">{actions}</div>}
    </div>
  );
}
export function Field({
  label,
  error,
  description,
  children,
  required,
  group = false,
}: {
  label: string;
  error?: string;
  description?: string;
  children: ReactNode;
  required?: boolean;
  group?: boolean;
}) {
  const Container = group ? "div" : "label";
  return (
    <Container
      className="a-field"
      role={group ? "group" : undefined}
      aria-label={group ? label : undefined}
    >
      <span>
        {label}
        {required && <span aria-hidden> *</span>}
      </span>
      {children}
      {description && <small>{description}</small>}
      {error && (
        <small role="alert" className="a-error">
          {error}
        </small>
      )}
    </Container>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  placement = "center",
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  placement?: "center" | "right" | "left";
  className?: string;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const dark = useContext(AdminThemeContext);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className={`admin-root a-portal ${dark ? "dark" : ""}`}>
          <Dialog.Overlay className="a-overlay" />
          <Dialog.Content
            onOpenAutoFocus={() => {
              opener.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={(event) => {
              if (opener.current?.isConnected) {
                event.preventDefault();
                opener.current.focus();
              }
            }}
            className={`a-modal ${wide ? "a-modal-wide" : ""} ${placement !== "center" ? "a-modal-" + placement : ""} ${className}`}
          >
            <header>
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description>
                  {description ?? "Kiểm tra thông tin trước khi lưu."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button size="icon" variant="ghost" aria-label="Đóng">
                  <X size={18} />
                </Button>
              </Dialog.Close>
            </header>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onCancel();
      }}
      title={title}
      description={description}
    >
      <div className="a-dialog-body">
        {error && (
          <p className="a-error" role="alert">
            {error}
          </p>
        )}
        <div className="a-actions a-right">
          <Button onClick={onCancel} disabled={busy}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm();
                onCancel();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Thao tác thất bại");
              } finally {
                setBusy(false);
              }
            }}
          >
            Xác nhận
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export function ActionMenu({
  label = "Thao tác",
  items,
  trigger,
}: {
  label?: string;
  trigger?: ReactNode;
  items: { label: string; onSelect: () => void; disabled?: boolean; danger?: boolean }[];
}) {
  const dark = useContext(AdminThemeContext);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size={trigger ? "md" : "icon"} variant="ghost" aria-label={label}>
          {trigger ?? <MoreHorizontal size={17} />}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={`admin-root a-menu ${dark ? "dark" : ""}`} sideOffset={5}>
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={item.danger ? "a-error" : ""}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function Tooltip({
  label,
  children,
  side,
  enabled = true,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  enabled?: boolean;
}) {
  const dark = useContext(AdminThemeContext);
  if (!enabled) return <>{children}</>;
  return (
    <RadixTooltip.Provider delayDuration={150}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            className={`admin-root a-tooltip ${dark ? "dark" : ""}`}
            sideOffset={5}
            side={side}
          >
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
type Toast = { id: number; text: string; tone: "success" | "error" | "info" };
const NoticeContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Toast[]>([]);
  const notify = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setNotices((v) => [...v, { id, text, tone }]);
    setTimeout(() => setNotices((v) => v.filter((n) => n.id !== id)), 5000);
  };
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div className="a-notices" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={`a-notice a-notice-${n.tone}`}>
            {n.tone === "success" ? <Check size={17} /> : <AlertCircle size={17} />}
            <span>{n.text}</span>
            <button
              aria-label="Bỏ thông báo"
              onClick={() => setNotices((v) => v.filter((x) => x.id !== n.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}
export const useNotice = () => useContext(NoticeContext);
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="a-state" role="alert">
      <AlertCircle size={24} />
      <h3>Không tải được dữ liệu</h3>
      <p>{error instanceof Error ? error.message : "Có lỗi khi xử lý. Hãy thử lại."}</p>
      {onRetry && <Button onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}
export function EmptyState({
  title = "Chưa có dữ liệu",
  description = "Thử đổi bộ lọc hoặc tạo mục mới.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="a-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="Đang tải" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="a-skeleton" key={i} />
      ))}
    </div>
  );
}
